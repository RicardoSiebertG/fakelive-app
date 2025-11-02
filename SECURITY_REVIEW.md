# Security Review & Corrections - Premium Payment System

## Critical Security Issues Found

### 🔴 CRITICAL - Must Fix Before Implementation

#### 1. **Payment Amount Verification Missing**

**Issue:** Client could potentially manipulate tier selection to pay less
**Risk:** Financial loss, premium access for reduced payment

**Original Flow:**
```typescript
// Client sends tier
createPayPalOrder({ tier: 'monthly' })

// Server trusts client's tier selection
```

**FIX:**
```typescript
// Server ALWAYS verifies amount from PayPal response
async capturePayPalOrder(orderId: string) {
  // 1. Capture from PayPal
  const capture = await paypal.captureOrder(orderId);

  // 2. Verify amount matches expected tier prices
  const actualAmount = parseFloat(capture.purchase_units[0].amount.value);
  const paymentRecord = await getPaymentRecord(orderId);
  const expectedAmount = TIER_PRICES[paymentRecord.tier];

  if (actualAmount !== expectedAmount) {
    throw new Error('Payment amount mismatch - potential fraud');
  }

  // 3. Only then grant premium
}
```

#### 2. **Race Condition in Payment Capture**

**Issue:** Multiple simultaneous captures could grant premium multiple times
**Risk:** Premium granted without payment, data inconsistency

**FIX - Use Firestore Transactions:**
```typescript
async function grantPremium(userId: string, tier: string) {
  const userRef = db.collection('users').doc(userId);

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    // Check if premium already active
    if (userDoc.data()?.premiumStatus?.isPremium) {
      throw new Error('Premium already active');
    }

    // Atomic update
    transaction.update(userRef, {
      'premiumStatus.isPremium': true,
      'premiumStatus.tier': tier,
      'premiumStatus.startedAt': FieldValue.serverTimestamp(),
      'premiumStatus.expiresAt': calculateExpiration(tier),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
}
```

#### 3. **Webhook Replay Attack Protection Incomplete**

**Issue:** Attacker could replay captured webhooks to extend premium
**Risk:** Unauthorized premium extensions

**FIX - Track Transmission IDs:**
```typescript
// Add to webhook processing
async function processWebhook(req, res) {
  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];

  // Check if we've processed this webhook before
  const webhookRef = db.collection('paypal_webhooks').doc(transmissionId);
  const existing = await webhookRef.get();

  if (existing.exists) {
    console.log('Duplicate webhook, already processed');
    return res.sendStatus(200); // Return 200 to prevent retries
  }

  // Verify webhook signature
  const isValid = await verifyPayPalSignature(req);
  if (!isValid) {
    return res.sendStatus(401);
  }

  // Store webhook with transmission ID as document ID
  await webhookRef.set({
    transmissionId,
    transmissionTime,
    eventType: req.body.event_type,
    processedAt: FieldValue.serverTimestamp(),
    // ... other data
  });

  // Process webhook...
}
```

#### 4. **Missing Payment Idempotency**

**Issue:** User clicking "Pay" multiple times could create duplicate orders
**Risk:** User charged multiple times

**FIX - Idempotency Keys:**
```typescript
async function createPayPalOrder(userId: string, tier: string, idempotencyKey: string) {
  // Check if order with this idempotency key exists
  const existingPayment = await db.collection('payments')
    .where('userId', '==', userId)
    .where('idempotencyKey', '==', idempotencyKey)
    .where('status', 'in', ['pending', 'completed'])
    .limit(1)
    .get();

  if (!existingPayment.empty) {
    // Return existing order
    return {
      orderId: existingPayment.docs[0].data().paypalOrderId
    };
  }

  // Create new order...
}

// Frontend generates idempotency key
const idempotencyKey = `${userId}-${Date.now()}-${Math.random()}`;
```

#### 5. **User Premium Status Client-Side Check Only**

**Issue:** Client-side checks can be bypassed with browser DevTools
**Risk:** Users could bypass premium restrictions

**FIX - Server-Side Enforcement:**
```typescript
// Add cloud function to validate premium on live stream start
export const startLiveStream = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { platform, viewerCount, isVerified } = data;
  const userId = context.auth.uid;

  // Get user's premium status from Firestore (server-side)
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const user = userDoc.data();

  const isPremium = user?.premiumStatus?.isPremium &&
                    user?.premiumStatus?.expiresAt?.toDate() > new Date();

  const hasFullFeatures = (context.auth.token.email_verified) || isPremium;

  // Server-side validation
  if (!hasFullFeatures) {
    if (viewerCount > 500) {
      throw new functions.https.HttpsError('permission-denied', 'Viewer limit exceeded');
    }
    if (isVerified) {
      throw new functions.https.HttpsError('permission-denied', 'Verified badge requires premium');
    }
  }

  // Validate max limits even for premium
  if (viewerCount > 999999) {
    throw new functions.https.HttpsError('invalid-argument', 'Viewer count too high');
  }

  // Track stream start...
  return { success: true };
});
```

### 🟡 HIGH - Should Fix Before Launch

#### 6. **PII Storage Without Consent**

**Issue:** Storing IP addresses and user agents without user consent
**Risk:** GDPR/Privacy violations

**FIX:**
```typescript
// Remove automatic IP/user agent collection
// OR add explicit consent checkbox

interface Payment {
  // Remove these fields:
  // ipAddress?: string;
  // userAgent?: string;

  // Only log for fraud detection with user consent
  metadata?: {
    fraudCheckData?: string; // Encrypted/hashed if needed
  };
}
```

#### 7. **Sensitive Data in Webhook Logs**

**Issue:** Storing raw webhook data could include sensitive information
**Risk:** Data exposure if Firestore is compromised

**FIX:**
```typescript
// Sanitize webhook data before storing
function sanitizeWebhookData(webhookBody: any) {
  return {
    event_type: webhookBody.event_type,
    resource_type: webhookBody.resource_type,
    summary: webhookBody.summary,
    // DO NOT store full payer information
    amount: webhookBody.resource?.amount,
    status: webhookBody.resource?.status,
    // Exclude: email, name, address, phone, etc.
  };
}

await webhookRef.set({
  // ...
  sanitizedData: sanitizeWebhookData(req.body),
  // rawData: req.body // ❌ DON'T DO THIS
});
```

#### 8. **Missing Rate Limiting Implementation**

**Issue:** No concrete rate limiting implementation provided
**Risk:** DoS attacks, payment spam

**FIX - Implement Rate Limiting:**
```typescript
// Use Firebase Extensions: Limit Repeated Requests
// OR manual implementation:

async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);

  const recentAttempts = await db.collection('rate_limits')
    .doc(userId)
    .collection(action)
    .where('timestamp', '>', oneHourAgo)
    .get();

  if (recentAttempts.size >= 5) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Too many attempts. Please try again later.'
    );
  }

  // Log this attempt
  await db.collection('rate_limits')
    .doc(userId)
    .collection(action)
    .add({ timestamp: now });

  return true;
}

// In callable function:
await checkRateLimit(userId, 'create_payment');
```

#### 9. **No Input Validation on Tier Parameter**

**Issue:** Tier parameter not strictly validated
**Risk:** Unexpected behavior, potential exploits

**FIX:**
```typescript
const VALID_TIERS = ['monthly', 'yearly'] as const;
const TIER_PRICES = {
  monthly: 4.99,
  yearly: 29.99
} as const;

function validateTier(tier: any): tier is 'monthly' | 'yearly' {
  return VALID_TIERS.includes(tier);
}

async function createPayPalOrder(data: any, context: any) {
  if (!validateTier(data.tier)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid tier specified'
    );
  }

  const price = TIER_PRICES[data.tier];
  // ...
}
```

### 🟢 MEDIUM - Recommended Improvements

#### 10. **Webhook Signature Verification Needs Proper Implementation**

**Current:** Generic mention
**Fix:** Specific implementation

```typescript
import crypto from 'crypto';

async function verifyPayPalWebhookSignature(req: functions.Request): Promise<boolean> {
  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const certUrl = req.headers['paypal-cert-url'];
  const authAlgo = req.headers['paypal-auth-algo'];
  const transmissionSig = req.headers['paypal-transmission-sig'];
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  // Use PayPal SDK to verify
  const paypal = require('@paypal/checkout-server-sdk');

  const crc = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(req.rawBody)}`;

  // Verify using PayPal SDK
  try {
    const isValid = await paypal.webhooks.verifyWebhookSignature({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: req.body
    });

    return isValid.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return false;
  }
}
```

#### 11. **Premium Expiration Check Must Use Server Time**

**Issue:** Client could manipulate system time
**Risk:** Extended premium access

**FIX:**
```typescript
// Always use Firestore server timestamp
function isPremiumActive(premiumStatus: any): boolean {
  if (!premiumStatus?.isPremium) {
    return false;
  }

  // Use server timestamp, not client time
  const now = admin.firestore.Timestamp.now();
  const expiresAt = premiumStatus.expiresAt;

  return expiresAt && expiresAt > now;
}

// In Firestore rules:
match /users/{userId} {
  function isPremium() {
    let premium = resource.data.premiumStatus;
    return premium != null &&
           premium.isPremium == true &&
           premium.expiresAt > request.time; // Server time!
  }
}
```

#### 12. **Error Messages Leak Information**

**Issue:** Detailed errors could help attackers
**Risk:** Information disclosure

**FIX:**
```typescript
// Don't expose PayPal API errors
try {
  const order = await paypal.createOrder(/* ... */);
} catch (error) {
  // Log detailed error server-side
  console.error('PayPal API error:', error);

  // Return generic error to client
  throw new functions.https.HttpsError(
    'internal',
    'Payment service temporarily unavailable'
  );
}
```

## Updated Firestore Security Rules

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

    function hasVerifiedEmail() {
      return isAuthenticated() && request.auth.token.email_verified == true;
    }

    function isPremium() {
      let premium = resource.data.premiumStatus;
      return premium != null &&
             premium.isPremium == true &&
             premium.expiresAt != null &&
             premium.expiresAt > request.time;
    }

    function hasFullFeatures() {
      return hasVerifiedEmail() || isPremium();
    }

    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if isOwner(userId);

      // Users can update stats, but NOT premiumStatus
      allow update: if isOwner(userId) &&
                    !request.resource.data.diff(resource.data)
                      .affectedKeys()
                      .hasAny(['premiumStatus']);

      // Only cloud functions can write premiumStatus
      // (no allow write rule - only admin SDK)
    }

    // Payments collection - read-only for users
    match /payments/{paymentId} {
      allow read: if isAuthenticated() &&
                  resource.data.userId == request.auth.uid;
      allow write: if false; // Only cloud functions
    }

    // Webhooks - no public access
    match /paypal_webhooks/{webhookId} {
      allow read, write: if false;
    }

    // Rate limiting collection
    match /rate_limits/{userId}/{action}/{attemptId} {
      allow read: if isOwner(userId);
      allow write: if false; // Only cloud functions
    }
  }
}
```

## Additional Security Recommendations

### 1. Environment Variables Security

```bash
# Never commit these to Git!
# Use Firebase Secret Manager

# Store secrets:
firebase functions:secrets:set PAYPAL_CLIENT_SECRET
firebase functions:secrets:set PAYPAL_WEBHOOK_ID

# Reference in code:
const secret = process.env.PAYPAL_CLIENT_SECRET;
```

### 2. CORS Configuration

```typescript
// Webhook endpoint should NOT have CORS
// Callable functions have CORS handled by Firebase

// If using HTTP functions for frontend:
const cors = require('cors')({ origin: true });

exports.httpFunction = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    // Validate origin
    const allowedOrigins = ['https://fakelive.app', 'https://www.fakelive.app'];
    if (!allowedOrigins.includes(req.headers.origin)) {
      return res.status(403).send('Forbidden');
    }
    // ...
  });
});
```

### 3. Audit Logging

```typescript
// Log all premium-related actions
async function logAuditEvent(event: {
  userId: string;
  action: string;
  details: any;
  ipAddress?: string;
  success: boolean;
}) {
  await db.collection('audit_logs').add({
    ...event,
    timestamp: FieldValue.serverTimestamp()
  });
}

// Example:
await logAuditEvent({
  userId,
  action: 'premium_granted',
  details: { tier: 'monthly', paymentId },
  success: true
});
```

### 4. Monitoring & Alerts

```typescript
// Set up alerting for:
// - High payment failure rates
// - Webhook verification failures
// - Rate limit violations
// - Unusual payment patterns

// Use Firebase Performance Monitoring
// Use Cloud Monitoring for alerts
```

### 5. Payment Reconciliation

```typescript
// Scheduled function to reconcile payments
export const reconcilePayments = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    // Check for:
    // 1. Completed payments without premium granted
    // 2. Premium users without payment record
    // 3. Expired pending payments

    // Alert on discrepancies
  });
```

### 6. Refund Handling

```typescript
// When refund webhook received:
async function handleRefund(paypalOrderId: string) {
  // Find payment
  const payment = await findPaymentByOrderId(paypalOrderId);

  // Revoke premium immediately
  await db.collection('users').doc(payment.userId).update({
    'premiumStatus.isPremium': false,
    'premiumStatus.expiresAt': null,
    updatedAt: FieldValue.serverTimestamp()
  });

  // Update payment status
  await db.collection('payments').doc(payment.id).update({
    status: 'refunded',
    refundedAt: FieldValue.serverTimestamp()
  });

  // Log for audit
  await logAuditEvent({
    userId: payment.userId,
    action: 'premium_revoked_refund',
    details: { paymentId: payment.id },
    success: true
  });
}
```

## Testing Security

### Penetration Testing Checklist

- [ ] Attempt to capture someone else's payment
- [ ] Attempt to modify tier after order creation
- [ ] Attempt to replay captured webhook
- [ ] Attempt to bypass rate limiting
- [ ] Attempt to manipulate premium expiration date
- [ ] Attempt SQL injection in all inputs
- [ ] Attempt XSS in all inputs
- [ ] Test with invalid PayPal signatures
- [ ] Test concurrent payment captures
- [ ] Test payment with manipulated amount

### Security Audit Before Production

1. Run `npm audit` on cloud functions
2. Check all dependencies for vulnerabilities
3. Review all environment variables
4. Verify Firestore rules with simulator
5. Test webhook signature verification
6. Verify rate limiting works
7. Check error messages don't leak info
8. Verify logging doesn't include PII
9. Test PayPal sandbox thoroughly
10. Perform penetration testing

## Compliance Considerations

### GDPR Compliance

- [ ] Add privacy policy for payment processing
- [ ] Allow users to request data deletion
- [ ] Don't store unnecessary PII
- [ ] Encrypt payment data at rest (Firestore default)
- [ ] Allow users to export their data

### PCI DSS Compliance

✅ **Not Required** - We never handle card data directly
- PayPal handles all card processing
- We only store PayPal order IDs
- No card numbers, CVVs, or expiration dates stored

### Terms of Service

- [ ] Add refund policy
- [ ] Specify premium access terms
- [ ] Define what happens on refund
- [ ] State no auto-renewal (one-time payment)

---

## Summary of Critical Fixes

1. ✅ **Payment amount verification** - Server validates amount from PayPal
2. ✅ **Atomic premium granting** - Use Firestore transactions
3. ✅ **Webhook replay protection** - Track transmission IDs
4. ✅ **Payment idempotency** - Use idempotency keys
5. ✅ **Server-side premium enforcement** - Add cloud function validation
6. ✅ **Remove PII collection** - Don't store IP/user agent without consent
7. ✅ **Sanitize webhook data** - Don't store raw sensitive data
8. ✅ **Implement rate limiting** - Prevent spam/DoS
9. ✅ **Strict input validation** - Validate all user inputs
10. ✅ **Proper webhook verification** - Use PayPal SDK verification

All critical issues must be addressed before production deployment.
