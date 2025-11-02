# Premium Payment System - Architecture Plan

## Overview

This document outlines the architecture for implementing a premium payment system using PayPal one-time payments (not subscriptions) to unlock unlimited viewers and verified badge access.

**✅ Security Review Completed:** This plan has been reviewed and updated with critical security corrections. See [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) for detailed security audit and corrections applied.

## Pricing Tiers

| Tier | Duration | Price | Features |
|------|----------|-------|----------|
| Premium Monthly | 30 days | $4.99 | Unlimited viewers (999,999), Verified badge |
| Premium Yearly | 365 days | $29.99 | Unlimited viewers (999,999), Verified badge, Save 50% |

## Data Models

### Firestore Collections

#### 1. `users/{userId}` (existing, extend)
```typescript
interface UserStats {
  userId: string;
  email?: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;

  // Platform-specific statistics (existing)
  instagramStats: PlatformStats;
  tiktokStats: PlatformStats;
  facebookStats: PlatformStats;
  totalLiveStreamCount: number;

  // Premium subscription info (NEW)
  premiumStatus?: {
    isPremium: boolean;
    tier: 'monthly' | 'yearly' | null;
    expiresAt: Date | null;
    startedAt: Date | null;
    autoRenew: false; // Always false for one-time payments
  };
}
```

#### 2. `payments/{paymentId}` (NEW)
```typescript
interface Payment {
  paymentId: string; // Firebase generated ID
  userId: string;

  // PayPal details
  paypalOrderId: string;
  paypalCaptureId?: string; // Set after successful capture

  // Payment info
  tier: 'monthly' | 'yearly';
  amount: number;
  currency: 'USD';

  // Status tracking
  status: 'pending' | 'completed' | 'failed' | 'refunded';

  // Idempotency (prevents duplicate payments)
  idempotencyKey: string;

  // Timestamps
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date; // When premium access expires

  // Note: IP address and user agent removed for privacy compliance
  // Only store if user explicitly consents for fraud prevention
}
```

#### 3. `paypal_webhooks/{webhookId}` (NEW - for debugging/audit)
```typescript
interface PayPalWebhook {
  webhookId: string; // Use PayPal transmission ID as document ID
  transmissionId: string; // PayPal transmission ID (for replay protection)
  transmissionTime: string; // PayPal transmission time
  eventType: string;
  resourceType: string;
  paypalOrderId?: string;
  receivedAt: Date;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  // Sanitized data only (no PII, no sensitive payer information)
  sanitizedData: {
    event_type: string;
    resource_type: string;
    summary?: string;
    amount?: any;
    status?: string;
  };
}
```

## Architecture Flow

### 1. User Initiates Payment

```
User clicks "Get Premium"
  → Frontend calls createPayPalOrder(tier)
  → Cloud Function creates PayPal order
  → Returns order ID to frontend
  → Frontend opens PayPal checkout
```

### 2. PayPal Checkout

```
User completes payment in PayPal modal
  → PayPal redirects to return URL
  → Frontend calls capturePayPalOrder(orderId)
  → Cloud Function captures payment
  → Updates user premium status
  → Returns success to frontend
```

### 3. Webhook Verification (Backup)

```
PayPal sends webhook to Cloud Function
  → Verify webhook signature
  → Verify payment status
  → Update user premium status (if not already done)
  → Log webhook for audit
```

## Firebase Cloud Functions

### Structure

```
firebase/
├── .firebaserc
├── firebase.json
├── functions/
    ├── package.json
    ├── tsconfig.json
    ├── src/
        ├── index.ts
        ├── config/
        │   └── paypal.config.ts
        ├── callable/
        │   ├── createPayPalOrder.ts
        │   ├── capturePayPalOrder.ts
        │   └── validateLiveStreamStart.ts (NEW - Server-side enforcement)
        ├── webhooks/
        │   └── paypalWebhook.ts
        ├── helpers/
        │   ├── paypal.helper.ts
        │   ├── premium.helper.ts
        │   ├── validation.helper.ts
        │   └── rateLimit.helper.ts (NEW - Rate limiting logic)
        └── types/
            └── payment.types.ts
```

### 1. Callable Function: `createPayPalOrder`

**Purpose:** Create a PayPal order for premium purchase

**Input:**
```typescript
{
  tier: 'monthly' | 'yearly',
  idempotencyKey: string // Client-generated unique key to prevent duplicate orders
}
```

**Security Checks:**
- User must be authenticated
- User must have verified email
- User must not already have active premium
- Validate tier is exactly 'monthly' or 'yearly' (strict validation)
- Rate limiting: max 5 payment creation attempts per hour per user
- Idempotency: check if order with same idempotencyKey already exists

**Process:**
1. Verify user authentication
2. Check rate limit (max 5 attempts per hour)
3. Validate tier parameter with strict type checking
4. Check for existing order with same idempotencyKey (return existing if found)
5. Check if user already has active premium
6. Get price based on tier (server-side mapping, never trust client)
7. Create PayPal order via PayPal API
8. Store payment record in Firestore with status 'pending' and idempotencyKey
9. Return PayPal order ID

**Output:**
```typescript
{
  orderId: string; // PayPal order ID
  amount: number;
  tier: string;
}
```

**Implementation Notes:**
```typescript
// Strict tier validation
const VALID_TIERS = ['monthly', 'yearly'] as const;
const TIER_PRICES = {
  monthly: 4.99,
  yearly: 29.99
} as const;

// Idempotency check
const existingPayment = await db.collection('payments')
  .where('userId', '==', userId)
  .where('idempotencyKey', '==', idempotencyKey)
  .where('status', 'in', ['pending', 'completed'])
  .limit(1)
  .get();

if (!existingPayment.empty) {
  return { orderId: existingPayment.docs[0].data().paypalOrderId };
}
```

### 2. Callable Function: `capturePayPalOrder`

**Purpose:** Capture payment after user approves in PayPal

**Input:**
```typescript
{
  orderId: string; // PayPal order ID
}
```

**Security Checks:**
- User must be authenticated
- Order must belong to the calling user
- Order must be in 'pending' status
- Verify order hasn't already been captured
- **CRITICAL:** Verify payment amount matches expected tier price from PayPal response
- Use Firestore transaction to prevent race conditions

**Process:**
1. Verify user owns this order
2. Retrieve payment record from Firestore
3. Capture payment via PayPal API
4. **CRITICAL:** Verify actual amount from PayPal matches expected tier price
5. Verify capture was successful
6. Calculate expiration date based on tier
7. Use Firestore transaction to atomically:
   - Check premium is not already active
   - Update user's premium status
   - Update payment record to 'completed'
8. Return success

**Output:**
```typescript
{
  success: boolean;
  premiumExpiresAt: Date;
  tier: string;
}
```

**Implementation Notes:**
```typescript
// Payment amount verification (CRITICAL)
const capture = await paypal.captureOrder(orderId);
const actualAmount = parseFloat(capture.purchase_units[0].amount.value);
const expectedAmount = TIER_PRICES[paymentRecord.tier];

if (actualAmount !== expectedAmount) {
  throw new Error('Payment amount mismatch - potential fraud');
}

// Atomic premium granting with Firestore transaction
await db.runTransaction(async (transaction) => {
  const userDoc = await transaction.get(userRef);

  if (userDoc.data()?.premiumStatus?.isPremium) {
    throw new Error('Premium already active');
  }

  const expiresAt = calculateExpiration(tier);

  transaction.update(userRef, {
    'premiumStatus.isPremium': true,
    'premiumStatus.tier': tier,
    'premiumStatus.startedAt': FieldValue.serverTimestamp(),
    'premiumStatus.expiresAt': expiresAt,
    updatedAt: FieldValue.serverTimestamp()
  });

  transaction.update(paymentRef, {
    status: 'completed',
    completedAt: FieldValue.serverTimestamp(),
    paypalCaptureId: capture.id
  });
});
```

### 3. HTTP Function: `paypalWebhook`

**Purpose:** Handle PayPal webhook events (backup verification)

**Security Checks:**
- **CRITICAL:** Verify PayPal webhook signature using PayPal SDK
- **CRITICAL:** Check transmission ID to prevent replay attacks
- Verify webhook came from PayPal servers
- Check webhook hasn't been processed before (idempotency)
- Sanitize webhook data before storing (remove PII)

**Handled Events:**
- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`

**Process:**
1. Extract transmission ID from headers
2. Check if transmission ID already exists in Firestore (replay protection)
3. If exists, return 200 immediately (already processed)
4. Verify webhook signature using PayPal SDK
5. If signature invalid, return 401
6. Store webhook with transmission ID as document ID (prevents duplicate processing)
7. Extract order ID from webhook
8. Find payment record in Firestore
9. Update payment status based on event type using transaction
10. Update user premium status if needed using transaction
11. Sanitize and store webhook data (no PII)
12. Mark webhook as processed

**Implementation Notes:**
```typescript
// Replay protection with transmission ID
const transmissionId = req.headers['paypal-transmission-id'];
const transmissionTime = req.headers['paypal-transmission-time'];

const webhookRef = db.collection('paypal_webhooks').doc(transmissionId);
const existing = await webhookRef.get();

if (existing.exists) {
  console.log('Duplicate webhook, already processed');
  return res.sendStatus(200);
}

// Verify signature using PayPal SDK
const isValid = await verifyPayPalWebhookSignature(req);
if (!isValid) {
  return res.sendStatus(401);
}

// Sanitize data before storing
const sanitizedData = {
  event_type: req.body.event_type,
  resource_type: req.body.resource_type,
  summary: req.body.summary,
  amount: req.body.resource?.amount,
  status: req.body.resource?.status
  // DO NOT store: email, name, address, phone, full payer info
};

// Store with transmission ID as document ID
await webhookRef.set({
  transmissionId,
  transmissionTime,
  eventType: req.body.event_type,
  processedAt: FieldValue.serverTimestamp(),
  sanitizedData,
  // rawData: req.body // ❌ NEVER store raw webhook data
});
```

### 4. Callable Function: `validateLiveStreamStart` (NEW - Server-Side Enforcement)

**Purpose:** Validate and track live stream start with server-side premium enforcement

**Input:**
```typescript
{
  platform: 'instagram' | 'tiktok' | 'facebook',
  viewerCount: number,
  isVerified: boolean
}
```

**Security Checks:**
- User must be authenticated
- **CRITICAL:** Server-side validation of premium status (cannot be bypassed)
- Verify premium expiration using server timestamp (not client time)
- Enforce feature limits based on actual premium status from Firestore

**Process:**
1. Verify user authentication
2. Get user's premium status from Firestore (server-side, authoritative)
3. Check if premium is active using server timestamp
4. Determine if user has full features (verified email OR active premium)
5. If no full features:
   - Reject if viewerCount > 500
   - Reject if isVerified = true
6. If full features, enforce absolute max (viewerCount <= 999999)
7. Track live stream start in Firestore
8. Return success

**Output:**
```typescript
{
  success: boolean;
  hasFullFeatures: boolean;
  maxViewerCount: number;
  canUseVerified: boolean;
}
```

**Implementation Notes:**
```typescript
// Server-side premium check (CRITICAL - cannot be bypassed)
export const validateLiveStreamStart = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { platform, viewerCount, isVerified } = data;
  const userId = context.auth.uid;

  // Get user's premium status from Firestore (authoritative)
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const user = userDoc.data();

  // Check premium using SERVER timestamp
  const now = admin.firestore.Timestamp.now();
  const isPremium = user?.premiumStatus?.isPremium &&
                    user?.premiumStatus?.expiresAt &&
                    user.premiumStatus.expiresAt > now;

  const hasFullFeatures = (context.auth.token.email_verified === true) || isPremium;

  // Server-side enforcement (CRITICAL)
  if (!hasFullFeatures) {
    if (viewerCount > 500) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Viewer limit exceeded. Sign in and verify email or upgrade to premium.'
      );
    }
    if (isVerified) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Verified badge requires email verification or premium.'
      );
    }
  }

  // Absolute maximum for all users
  if (viewerCount > 999999) {
    throw new functions.https.HttpsError('invalid-argument', 'Viewer count too high');
  }

  // Track stream start
  await trackLiveStreamStart(userId, platform);

  return {
    success: true,
    hasFullFeatures,
    maxViewerCount: hasFullFeatures ? 999999 : 500,
    canUseVerified: hasFullFeatures
  };
});
```

**Why This Is Critical:**
Client-side checks can be bypassed using browser DevTools. This server-side function ensures that premium restrictions cannot be circumvented, as all validation happens on the backend with authoritative data from Firestore.

## PayPal Integration

### API Endpoints Used

1. **Create Order**
   - Endpoint: `POST /v2/checkout/orders`
   - Purpose: Create PayPal order

2. **Capture Order**
   - Endpoint: `POST /v2/checkout/orders/{order_id}/capture`
   - Purpose: Capture payment after approval

3. **Get Order Details**
   - Endpoint: `GET /v2/checkout/orders/{order_id}`
   - Purpose: Verify order details

### Environment Variables (Cloud Functions)

```
PAYPAL_CLIENT_ID=<PayPal Client ID>
PAYPAL_CLIENT_SECRET=<PayPal Secret>
PAYPAL_MODE=sandbox|production
PAYPAL_WEBHOOK_ID=<PayPal Webhook ID>
```

### PayPal Order Structure

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "reference_id": "userId",
    "description": "FakeLive Premium - Monthly",
    "amount": {
      "currency_code": "USD",
      "value": "4.99"
    },
    "custom_id": "paymentId-userId"
  }],
  "application_context": {
    "brand_name": "FakeLive",
    "return_url": "https://fakelive.app/premium/success",
    "cancel_url": "https://fakelive.app/premium/cancel"
  }
}
```

## Security Measures

### 1. Authentication & Authorization
- All callable functions require authenticated users
- Users must have verified email to purchase premium
- Verify user owns the payment before capture
- Rate limiting on payment creation (max 5 attempts per hour)

### 2. Payment Validation
- Verify payment amount matches expected tier price
- Validate tier is one of the allowed values
- Check for duplicate payments (idempotency)
- Verify PayPal order status before capture

### 3. Webhook Security
- Verify PayPal webhook signature using PayPal SDK
- Validate webhook transmission ID (prevent replay attacks)
- Store and check webhook IDs to prevent duplicate processing
- Validate webhook event type is expected

### 4. Data Security
- Never store PayPal credentials in Firestore
- Use Firebase Secret Manager for PayPal credentials
- Sanitize user input for SQL injection (even though using Firestore)
- Log all payment attempts for audit trail
- Encrypt sensitive data at rest (Firestore does this by default)

### 5. Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isNotAnonymous() {
      return isAuthenticated() && !request.auth.token.firebase.sign_in_provider == 'anonymous';
    }

    function hasVerifiedEmail() {
      return isAuthenticated() && request.auth.token.email_verified == true;
    }

    function isPremium() {
      let premium = resource.data.premiumStatus;
      return premium != null &&
             premium.isPremium == true &&
             premium.expiresAt != null &&
             premium.expiresAt > request.time; // Use SERVER time, not client
    }

    function hasFullFeatures() {
      return hasVerifiedEmail() || isPremium();
    }

    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if isOwner(userId);

      // Users can create their own document (for stats tracking)
      allow create: if isOwner(userId) && isNotAnonymous();

      // Users can update stats, but NEVER premiumStatus
      allow update: if isOwner(userId) &&
                    isNotAnonymous() &&
                    !request.resource.data.diff(resource.data)
                      .affectedKeys()
                      .hasAny(['premiumStatus']);

      // Prevent deletion
      allow delete: if false;
    }

    // Payments collection - read-only for users, write-only for cloud functions
    match /payments/{paymentId} {
      allow read: if isAuthenticated() &&
                  resource.data.userId == request.auth.uid;
      allow write: if false; // Only cloud functions via admin SDK
    }

    // Webhooks - no public access
    match /paypal_webhooks/{webhookId} {
      allow read, write: if false; // Only cloud functions
    }

    // Rate limiting collection
    match /rate_limits/{userId}/{action}/{attemptId} {
      allow read: if isOwner(userId);
      allow write: if false; // Only cloud functions
    }
  }
}
```

### 6. Error Handling
- Never expose PayPal API errors directly to frontend
- Return generic error messages to prevent information leakage
- Log detailed errors server-side for debugging
- Implement exponential backoff for failed webhook processing

### 7. Fraud Prevention
- Limit payment attempts per user (5 per hour) via rate limiting
- Monitor for unusual payment patterns (server-side)
- Verify payment amounts match tier prices (server-side)
- Use Firestore transactions to prevent race conditions
- Implement webhook replay protection with transmission IDs
- Use idempotency keys to prevent duplicate charges
- Implement CAPTCHA before payment (optional)
- Note: IP address tracking removed for privacy compliance (GDPR)

## Frontend Integration

### 1. Premium Status Service

```typescript
// src/app/services/premium.service.ts
export class PremiumService {
  // Check if user has active premium
  hasActivePremium(): boolean

  // Get premium expiration date
  getPremiumExpiration(): Date | null

  // Get premium tier
  getPremiumTier(): 'monthly' | 'yearly' | null

  // Create PayPal order (with idempotency key)
  async createOrder(tier: 'monthly' | 'yearly'): Promise<string>

  // Capture PayPal order
  async captureOrder(orderId: string): Promise<boolean>

  // NEW: Validate live stream start (server-side enforcement)
  async validateLiveStreamStart(
    platform: 'instagram' | 'tiktok' | 'facebook',
    viewerCount: number,
    isVerified: boolean
  ): Promise<{
    success: boolean;
    hasFullFeatures: boolean;
    maxViewerCount: number;
    canUseVerified: boolean;
  }>
}
```

### 2. Premium Dialog Component

```typescript
// Premium pricing modal
// Shows pricing tiers
// Integrates PayPal Smart Buttons
// Handles payment flow
```

### 3. PayPal SDK Integration

```html
<!-- Load PayPal SDK in index.html -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>
```

### 4. Update Firebase Service

```typescript
// Add premium check methods
isPremium(): boolean {
  const user = this.getCurrentUser();
  // Check if premium is active
}

hasFullFeatures(): boolean {
  // Check email verified OR premium
  return this.isEmailVerified() || this.isPremium();
}
```

## Premium Access Logic

### Current: Email Verified = Full Features
```typescript
hasFullFeatures() {
  return !isAnonymous() && isEmailVerified()
}
```

### New: Email Verified OR Premium = Full Features
```typescript
hasFullFeatures() {
  return (!isAnonymous() && isEmailVerified()) || isPremium()
}

isPremium() {
  return premiumStatus.isPremium
         && premiumStatus.expiresAt > now()
}
```

## Edge Cases & Error Handling

### 1. Payment Abandoned
- User creates order but doesn't complete PayPal checkout
- **Solution:** Payment stays in 'pending' status, expires after 3 hours
- Clean up pending payments with scheduled function

### 2. Webhook Arrives Before Capture
- PayPal webhook arrives before user completes checkout
- **Solution:** Webhook processes and grants premium before frontend capture call

### 3. Duplicate Payments
- User pays twice for same period
- **Solution:** Check for active premium before creating order, prevent duplicate orders

### 4. Refunds
- User requests refund through PayPal
- **Solution:** Webhook receives refund event, revokes premium access

### 5. Expired Premium
- Premium expires while user is using app
- **Solution:** Frontend checks premium status periodically, shows expiration notice

### 6. Network Failures
- Payment captured but frontend doesn't receive confirmation
- **Solution:** Webhook processes payment, frontend can query payment status

### 7. PayPal API Downtime
- PayPal API is unreachable
- **Solution:** Return user-friendly error, log for retry, implement circuit breaker

## Scheduled Functions (Cleanup)

### 1. Clean Up Expired Pending Payments
```typescript
// Runs daily
// Marks pending payments older than 3 hours as 'failed'
```

### 2. Send Expiration Reminders (Future)
```typescript
// Runs daily
// Send email to users 7 days before premium expires
```

## Testing Strategy

### 1. Unit Tests
- Test premium expiration calculation
- Test tier price mapping
- Test webhook signature verification

### 2. Integration Tests
- Test PayPal order creation
- Test PayPal order capture
- Test webhook processing

### 3. PayPal Sandbox Testing
- Test successful payment flow
- Test abandoned payment
- Test refund scenario
- Test webhook delivery

### 4. Security Tests
- Test unauthorized access to callable functions
- Test webhook signature validation
- Test payment amount tampering
- Test race conditions

## Deployment Checklist

- [ ] Set up PayPal business account
- [ ] Create PayPal app and get credentials
- [ ] Configure PayPal webhook endpoint
- [ ] Set environment variables in Firebase
- [ ] Deploy cloud functions
- [ ] Update Firestore security rules
- [ ] Test in PayPal sandbox
- [ ] Deploy frontend changes
- [ ] Test end-to-end in production
- [ ] Monitor logs for errors

## Monitoring & Logging

### Metrics to Track
- Payment success rate
- Average payment completion time
- Webhook processing time
- Premium conversion rate
- Payment failures by error type
- Active premium users count

### Logging
- Log all payment creation attempts
- Log all payment captures
- Log all webhook events
- Log all premium status changes
- Alert on high failure rates

## Cost Estimation

### PayPal Fees
- 2.9% + $0.30 per transaction (US)
- Monthly: $4.99 → Fee $0.44 → Net $4.55
- Yearly: $29.99 → Fee $1.17 → Net $28.82

### Firebase Costs
- Cloud Functions: ~$0.01 per payment
- Firestore: Minimal (few reads/writes per payment)
- Total: ~$0.02 per transaction

## Migration Plan

### Phase 1: Backend Setup
1. Create cloud functions folder structure
2. Implement PayPal integration
3. Deploy cloud functions
4. Test with sandbox

### Phase 2: Data Model Updates
1. Extend UserStats interface
2. Update Firestore security rules
3. Deploy rules

### Phase 3: Frontend Integration
1. Create premium service
2. Update Firebase service for premium checks
3. Create premium dialog component
4. Integrate PayPal SDK
5. Update setup components to check premium

### Phase 4: Testing & Launch
1. End-to-end testing in sandbox
2. Switch to production PayPal
3. Soft launch (selected users)
4. Monitor and fix issues
5. Full launch

## Future Enhancements

1. **Promo Codes**
   - Add discount code support
   - Track code usage

2. **Referral Program**
   - Give free premium for referrals
   - Track referral conversions

3. **Gift Subscriptions**
   - Allow users to gift premium to others

4. **Multiple Payment Methods**
   - Add Stripe integration
   - Add cryptocurrency support

5. **Usage Analytics**
   - Track premium user behavior
   - A/B test pricing

---

## Security Review Completed ✅

A comprehensive security review has been performed on this architecture plan. All critical security issues have been identified and corrected in this document.

### Critical Security Corrections Applied:
1. ✅ **Payment amount verification** - Server validates amount from PayPal response (capturePayPalOrder:265-272)
2. ✅ **Atomic premium granting** - Uses Firestore transactions to prevent race conditions (capturePayPalOrder:274-297)
3. ✅ **Webhook replay protection** - Tracks transmission IDs to prevent duplicate processing (paypalWebhook:333-343)
4. ✅ **Payment idempotency** - Uses idempotency keys to prevent duplicate orders (createPayPalOrder:168, 210-219)
5. ✅ **Server-side enforcement** - Added validateLiveStreamStart callable function (lines 372-470)
6. ✅ **PII removal** - Removed IP address and user agent collection (Payment model:70-71)
7. ✅ **Webhook data sanitization** - Only stores sanitized data, no PII (paypalWebhook:351-369)
8. ✅ **Rate limiting** - Implements 5 requests per hour limit (createPayPalOrder:177)
9. ✅ **Strict input validation** - Validates tier parameter with strict type checking (createPayPalOrder:176, 202-207)
10. ✅ **Updated Firestore security rules** - Comprehensive rules with helper functions (lines 550-621)

**See [SECURITY_REVIEW.md](./SECURITY_REVIEW.md) for complete security audit details.**

### Production Readiness Checklist:
- [ ] All corrections in this plan have been implemented
- [ ] PayPal SDK webhook verification is properly configured
- [ ] Environment variables are stored in Firebase Secret Manager
- [ ] Firestore security rules have been deployed and tested
- [ ] Rate limiting has been tested
- [ ] Penetration testing has been performed
- [ ] GDPR compliance review completed
- [ ] All dependencies audited with `npm audit`
