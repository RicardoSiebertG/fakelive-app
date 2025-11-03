# Cloudflare Architecture Plan - Premium Payment System

## Overview

Complete architecture for implementing the FakeLive premium payment system using Cloudflare infrastructure, removing all Firebase dependencies.

**Stack:**
- **Database:** Cloudflare D1 (SQLite)
- **ORM:** Drizzle ORM
- **Backend:** Cloudflare Workers with Hono framework
- **Authentication:** Better-auth
- **Payments:** PayPal REST API

## Architecture Diagram

```
┌─────────────────┐
│  Angular App    │
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTPS
         ▼
┌─────────────────────────────────────────┐
│     Cloudflare Workers (Hono API)       │
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ Better-auth  │  │  API Routes     │ │
│  │ Middleware   │  │  - /auth/*      │ │
│  └──────────────┘  │  - /api/*       │ │
│                    │  - /webhooks/*  │ │
│                    └─────────────────┘ │
└───────────┬─────────────────────────────┘
            │
            ▼
┌───────────────────────┐
│   Cloudflare D1       │
│   (SQLite Database)   │
│                       │
│  ┌─────────────────┐  │
│  │ Drizzle ORM     │  │
│  │ Schema & Queries│  │
│  └─────────────────┘  │
└───────────────────────┘
            ▲
            │
            │ SQL Queries via Drizzle
            │
┌───────────┴───────────┐
│   PayPal REST API     │
│   - Create Order      │
│   - Capture Order     │
│   - Webhooks          │
└───────────────────────┘
```

## 🚀 Quick Start Guide

### What This Does

This architecture completely replaces Firebase with Cloudflare infrastructure:
- ✅ **Automatic deployment** when you push to `main` branch
- ✅ **Database migrations** run automatically on deploy
- ✅ **Worker API** at `api.fakelive.app` handles all backend logic
- ✅ **Better-auth** for modern, secure authentication
- ✅ **PayPal integration** for premium payments
- ✅ **All security measures** from the security review included

### Deployment Flow

```
Push to main → GitHub Actions → D1 Migrations → Deploy Worker → Live ✅
```

### What You Need to Do

1. **One-time setup** (15 minutes):
   - Create D1 database
   - Get Cloudflare API token & Account ID
   - Add GitHub secrets
   - Configure custom domain
   - Create GitHub Actions workflow

2. **After setup** (automatic):
   - Just push code to `main`
   - Everything deploys automatically
   - Database migrations run automatically
   - Worker goes live at `api.fakelive.app`

See [Automatic Deployment Setup](#automatic-deployment-setup) section below for step-by-step instructions.

## Database Schema (Drizzle ORM)

### File: `src/db/schema.ts`

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Better-auth will manage these tables automatically:
// - user
// - session
// - account (for OAuth)
// - verification

// ============================================
// PREMIUM-RELATED TABLES
// ============================================

// Premium Status (extends user functionality)
export const premiumStatus = sqliteTable('premium_status', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  isPremium: integer('is_premium', { mode: 'boolean' }).notNull().default(false),
  tier: text('tier', { enum: ['monthly', 'yearly'] }),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Payments
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),

  // PayPal details
  paypalOrderId: text('paypal_order_id').notNull().unique(),
  paypalCaptureId: text('paypal_capture_id'),

  // Payment info
  tier: text('tier', { enum: ['monthly', 'yearly'] }).notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),

  // Status
  status: text('status', {
    enum: ['pending', 'completed', 'failed', 'refunded']
  }).notNull().default('pending'),

  // Idempotency
  idempotencyKey: text('idempotency_key').notNull().unique(),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});

// PayPal Webhooks (for audit and replay protection)
export const paypalWebhooks = sqliteTable('paypal_webhooks', {
  id: text('id').primaryKey(), // Use PayPal transmission ID
  transmissionId: text('transmission_id').notNull().unique(),
  transmissionTime: text('transmission_time').notNull(),
  eventType: text('event_type').notNull(),
  resourceType: text('resource_type'),
  paypalOrderId: text('paypal_order_id'),
  processed: integer('processed', { mode: 'boolean' }).notNull().default(false),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  error: text('error'),

  // Sanitized data (JSON)
  sanitizedData: text('sanitized_data', { mode: 'json' }),

  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// User Stats (live stream tracking)
export const userStats = sqliteTable('user_stats', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),

  // Instagram stats
  instagramLiveCount: integer('instagram_live_count').notNull().default(0),
  instagramLastStreamAt: integer('instagram_last_stream_at', { mode: 'timestamp' }),

  // TikTok stats
  tiktokLiveCount: integer('tiktok_live_count').notNull().default(0),
  tiktokLastStreamAt: integer('tiktok_last_stream_at', { mode: 'timestamp' }),

  // Facebook stats
  facebookLiveCount: integer('facebook_live_count').notNull().default(0),
  facebookLastStreamAt: integer('facebook_last_stream_at', { mode: 'timestamp' }),

  // Total
  totalLiveStreamCount: integer('total_live_stream_count').notNull().default(0),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Rate Limiting
export const rateLimits = sqliteTable('rate_limits', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'create_payment', 'capture_payment', etc.
  attemptedAt: integer('attempted_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  ipAddress: text('ip_address'), // Optional, for additional security
});

// Type exports
export type PremiumStatus = typeof premiumStatus.$inferSelect;
export type NewPremiumStatus = typeof premiumStatus.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PayPalWebhook = typeof paypalWebhooks.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type RateLimit = typeof rateLimits.$inferSelect;
```

## Monorepo Structure

```
fakelive-monorepo/
├── apps/
│   └── www/                     # Angular app (Cloudflare Pages)
│       ├── src/
│       └── angular.json
├── workers/
│   └── api/                     # NEW: Cloudflare Worker
│       ├── package.json
│       ├── wrangler.toml
│       ├── drizzle.config.ts
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                 # Main worker entry point
│       │   ├── db/
│       │   │   ├── schema.ts            # Drizzle schema
│       │   │   ├── migrations/          # SQL migrations
│       │   │   └── client.ts            # D1 client initialization
│       │   ├── auth/
│       │   │   ├── better-auth.ts       # Better-auth configuration
│       │   │   └── middleware.ts        # Auth middleware for Hono
│       │   ├── routes/
│       │   │   ├── auth.ts              # Better-auth routes
│       │   │   ├── payments.ts          # Payment API routes
│       │   │   ├── live-streams.ts      # Live stream validation
│       │   │   └── webhooks.ts          # PayPal webhooks
│       │   ├── lib/
│       │   │   ├── paypal.ts            # PayPal API client
│       │   │   ├── premium.ts           # Premium logic helpers
│       │   │   ├── rate-limit.ts        # Rate limiting logic
│       │   │   └── validation.ts        # Input validation
│       │   └── types/
│       │       └── env.ts               # Cloudflare Worker env types
│       └── .dev.vars                    # Local development secrets (gitignored)
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml             # Existing: Cloudflare Pages deployment
│       └── deploy-worker.yml            # NEW: Cloudflare Worker deployment
└── package.json                         # Root package.json
```

## Cloudflare Worker Configuration

### `wrangler.toml`

```toml
name = "fakelive-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "fakelive-app"
database_id = "your-database-id"

# Environment Variables (use wrangler secret for sensitive values)
[vars]
BETTER_AUTH_URL = "https://api.fakelive.app"
BETTER_AUTH_SECRET = "" # Set via: wrangler secret put BETTER_AUTH_SECRET
PAYPAL_MODE = "production" # or "sandbox"
PAYPAL_CLIENT_ID = "" # Set via: wrangler secret put PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET = "" # Set via: wrangler secret put PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID = "" # Set via: wrangler secret put PAYPAL_WEBHOOK_ID

# CORS
[env.production]
route = "api.fakelive.app/*"

[env.development]
route = "api-dev.fakelive.app/*"
```

### `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  driver: 'd1',
  dbCredentials: {
    wranglerConfigPath: 'wrangler.toml',
    dbName: 'fakelive-app',
  },
} satisfies Config;
```

## Better-auth Configuration

### `src/auth/better-auth.ts`

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDrizzle } from './db/client';

export function initAuth(env: Env) {
  const db = createDrizzle(env.DB);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendVerificationEmail: async (user, url) => {
        // TODO: Implement email sending (Resend, SendGrid, etc.)
        console.log(`Verification email for ${user.email}: ${url}`);
      },
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  });
}
```

### `src/auth/middleware.ts`

```typescript
import { Context, Next } from 'hono';
import type { Env } from '../types/env';

export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const session = c.get('session');

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
}

export async function requireVerifiedEmail(c: Context<{ Bindings: Env }>, next: Next) {
  const session = c.get('session');

  if (!session?.user?.emailVerified) {
    return c.json({ error: 'Email verification required' }, 403);
  }

  await next();
}
```

## Main Worker Entry Point

### `src/index.ts`

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initAuth } from './auth/better-auth';
import authRoutes from './routes/auth';
import paymentsRoutes from './routes/payments';
import liveStreamsRoutes from './routes/live-streams';
import webhooksRoutes from './routes/webhooks';
import type { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://fakelive.app', 'https://www.fakelive.app'],
  credentials: true,
}));

// Better-auth session middleware
app.use('*', async (c, next) => {
  const auth = initAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  });

  c.set('session', session);
  c.set('auth', auth);

  await next();
});

// Routes
app.route('/auth', authRoutes);
app.route('/api/payments', paymentsRoutes);
app.route('/api/live-streams', liveStreamsRoutes);
app.route('/webhooks', webhooksRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

export default app;
```

## Payment Routes

### `src/routes/payments.ts`

```typescript
import { Hono } from 'hono';
import { requireAuth, requireVerifiedEmail } from '../auth/middleware';
import { createPayPalOrder, capturePayPalOrder } from '../lib/paypal';
import { checkRateLimit } from '../lib/rate-limit';
import { eq, and } from 'drizzle-orm';
import { payments, premiumStatus } from '../db/schema';
import { createDrizzle } from '../db/client';
import { v4 as uuid } from 'uuid';
import type { Env } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

const TIER_PRICES = {
  monthly: 4.99,
  yearly: 29.99,
} as const;

// Create PayPal order
app.post('/create-order', requireAuth, requireVerifiedEmail, async (c) => {
  const session = c.get('session');
  const userId = session.user.id;
  const db = createDrizzle(c.env.DB);

  // Rate limiting: max 5 attempts per hour
  const allowed = await checkRateLimit(db, userId, 'create_payment', 5, 3600);
  if (!allowed) {
    return c.json({ error: 'Too many attempts. Please try again later.' }, 429);
  }

  const { tier, idempotencyKey } = await c.req.json<{
    tier: 'monthly' | 'yearly';
    idempotencyKey: string;
  }>();

  // Validate tier
  if (!['monthly', 'yearly'].includes(tier)) {
    return c.json({ error: 'Invalid tier' }, 400);
  }

  // Check for existing order with same idempotency key
  const existingPayment = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.idempotencyKey, idempotencyKey),
        // Status is pending or completed
      )
    )
    .limit(1);

  if (existingPayment.length > 0) {
    return c.json({
      orderId: existingPayment[0].paypalOrderId,
      amount: existingPayment[0].amount,
      tier: existingPayment[0].tier,
    });
  }

  // Check if user already has active premium
  const premium = await db
    .select()
    .from(premiumStatus)
    .where(eq(premiumStatus.userId, userId))
    .limit(1);

  if (premium.length > 0 && premium[0].isPremium && premium[0].expiresAt) {
    const now = new Date();
    if (premium[0].expiresAt > now) {
      return c.json({ error: 'You already have active premium' }, 400);
    }
  }

  // Get price
  const amount = TIER_PRICES[tier];

  // Create PayPal order
  const paypalOrder = await createPayPalOrder(c.env, {
    amount,
    currency: 'USD',
    description: `FakeLive Premium - ${tier}`,
    userId,
  });

  // Store payment record
  const paymentId = uuid();
  await db.insert(payments).values({
    id: paymentId,
    userId,
    paypalOrderId: paypalOrder.id,
    tier,
    amount,
    currency: 'USD',
    status: 'pending',
    idempotencyKey,
    createdAt: new Date(),
  });

  return c.json({
    orderId: paypalOrder.id,
    amount,
    tier,
  });
});

// Capture PayPal order
app.post('/capture-order', requireAuth, async (c) => {
  const session = c.get('session');
  const userId = session.user.id;
  const db = createDrizzle(c.env.DB);

  const { orderId } = await c.req.json<{ orderId: string }>();

  // Get payment record
  const payment = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.paypalOrderId, orderId),
        eq(payments.userId, userId)
      )
    )
    .limit(1);

  if (payment.length === 0) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment[0].status !== 'pending') {
    return c.json({ error: 'Payment already processed' }, 400);
  }

  // Capture payment from PayPal
  const capture = await capturePayPalOrder(c.env, orderId);

  // Verify amount matches expected price
  const actualAmount = parseFloat(capture.purchase_units[0].amount.value);
  const expectedAmount = TIER_PRICES[payment[0].tier];

  if (actualAmount !== expectedAmount) {
    await db
      .update(payments)
      .set({ status: 'failed' })
      .where(eq(payments.id, payment[0].id));

    return c.json({ error: 'Payment amount mismatch' }, 400);
  }

  // Calculate expiration
  const now = new Date();
  const expiresAt = new Date(now);
  if (payment[0].tier === 'monthly') {
    expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    expiresAt.setDate(expiresAt.getDate() + 365);
  }

  // Use transaction to update both payment and premium status atomically
  try {
    // Update payment
    await db
      .update(payments)
      .set({
        status: 'completed',
        paypalCaptureId: capture.id,
        completedAt: now,
        expiresAt,
      })
      .where(eq(payments.id, payment[0].id));

    // Update or create premium status
    const existing = await db
      .select()
      .from(premiumStatus)
      .where(eq(premiumStatus.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(premiumStatus)
        .set({
          isPremium: true,
          tier: payment[0].tier,
          startedAt: now,
          expiresAt,
          updatedAt: now,
        })
        .where(eq(premiumStatus.userId, userId));
    } else {
      await db.insert(premiumStatus).values({
        id: uuid(),
        userId,
        isPremium: true,
        tier: payment[0].tier,
        startedAt: now,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    return c.json({
      success: true,
      premiumExpiresAt: expiresAt,
      tier: payment[0].tier,
    });
  } catch (error) {
    console.error('Failed to grant premium:', error);
    return c.json({ error: 'Failed to grant premium access' }, 500);
  }
});

export default app;
```

## PayPal Integration Library

### `src/lib/paypal.ts`

```typescript
import type { Env } from '../types/env';

const PAYPAL_API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
};

async function getAccessToken(env: Env): Promise<string> {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE as keyof typeof PAYPAL_API_BASE];
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);

  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json<{ access_token: string }>();
  return data.access_token;
}

export async function createPayPalOrder(env: Env, params: {
  amount: number;
  currency: string;
  description: string;
  userId: string;
}) {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE as keyof typeof PAYPAL_API_BASE];
  const accessToken = await getAccessToken(env);

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: params.userId,
        description: params.description,
        amount: {
          currency_code: params.currency,
          value: params.amount.toFixed(2),
        },
        custom_id: params.userId,
      }],
      application_context: {
        brand_name: 'FakeLive',
        return_url: 'https://fakelive.app/premium/success',
        cancel_url: 'https://fakelive.app/premium/cancel',
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create PayPal order');
  }

  return await response.json();
}

export async function capturePayPalOrder(env: Env, orderId: string) {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE as keyof typeof PAYPAL_API_BASE];
  const accessToken = await getAccessToken(env);

  const response = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to capture PayPal order');
  }

  return await response.json();
}

export async function verifyWebhookSignature(
  env: Env,
  headers: Headers,
  body: any
): Promise<boolean> {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE as keyof typeof PAYPAL_API_BASE];
  const accessToken = await getAccessToken(env);

  const response = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: body,
    }),
  });

  const data = await response.json<{ verification_status: string }>();
  return data.verification_status === 'SUCCESS';
}
```

## Rate Limiting Helper

### `src/lib/rate-limit.ts`

```typescript
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { rateLimits } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function checkRateLimit(
  db: DrizzleD1Database,
  userId: string,
  action: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - (windowSeconds * 1000));

  // Count recent attempts
  const attempts = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.userId, userId),
        eq(rateLimits.action, action),
        gt(rateLimits.attemptedAt, windowStart)
      )
    );

  if (attempts.length >= maxAttempts) {
    return false;
  }

  // Log this attempt
  await db.insert(rateLimits).values({
    id: uuid(),
    userId,
    action,
    attemptedAt: now,
  });

  return true;
}

// Cleanup old rate limit entries (run periodically)
export async function cleanupRateLimits(
  db: DrizzleD1Database,
  olderThanHours: number = 24
) {
  const cutoff = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));

  await db
    .delete(rateLimits)
    .where(gt(rateLimits.attemptedAt, cutoff));
}
```

## Live Stream Validation Route

### `src/routes/live-streams.ts`

```typescript
import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware';
import { createDrizzle } from '../db/client';
import { premiumStatus, userStats } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import type { Env } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

// Server-side validation of live stream start
app.post('/validate-start', requireAuth, async (c) => {
  const session = c.get('session');
  const userId = session.user.id;
  const db = createDrizzle(c.env.DB);

  const { platform, viewerCount, isVerified } = await c.req.json<{
    platform: 'instagram' | 'tiktok' | 'facebook';
    viewerCount: number;
    isVerified: boolean;
  }>();

  // Get user's premium status
  const premium = await db
    .select()
    .from(premiumStatus)
    .where(eq(premiumStatus.userId, userId))
    .limit(1);

  const now = new Date();
  const isPremium = premium.length > 0 &&
                    premium[0].isPremium &&
                    premium[0].expiresAt &&
                    premium[0].expiresAt > now;

  const hasVerifiedEmail = session.user.emailVerified === true;
  const hasFullFeatures = hasVerifiedEmail || isPremium;

  // Server-side enforcement
  if (!hasFullFeatures) {
    if (viewerCount > 500) {
      return c.json({
        error: 'Viewer limit exceeded. Sign in and verify email or upgrade to premium.',
        maxViewerCount: 500,
      }, 403);
    }
    if (isVerified) {
      return c.json({
        error: 'Verified badge requires email verification or premium.',
      }, 403);
    }
  }

  // Absolute maximum
  if (viewerCount > 999999) {
    return c.json({ error: 'Viewer count too high' }, 400);
  }

  // Track stream start
  const stats = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);

  if (stats.length > 0) {
    const updates: any = {
      totalLiveStreamCount: stats[0].totalLiveStreamCount + 1,
      updatedAt: now,
    };

    if (platform === 'instagram') {
      updates.instagramLiveCount = stats[0].instagramLiveCount + 1;
      updates.instagramLastStreamAt = now;
    } else if (platform === 'tiktok') {
      updates.tiktokLiveCount = stats[0].tiktokLiveCount + 1;
      updates.tiktokLastStreamAt = now;
    } else if (platform === 'facebook') {
      updates.facebookLiveCount = stats[0].facebookLiveCount + 1;
      updates.facebookLastStreamAt = now;
    }

    await db
      .update(userStats)
      .set(updates)
      .where(eq(userStats.userId, userId));
  } else {
    // Create initial stats
    await db.insert(userStats).values({
      id: uuid(),
      userId,
      instagramLiveCount: platform === 'instagram' ? 1 : 0,
      instagramLastStreamAt: platform === 'instagram' ? now : null,
      tiktokLiveCount: platform === 'tiktok' ? 1 : 0,
      tiktokLastStreamAt: platform === 'tiktok' ? now : null,
      facebookLiveCount: platform === 'facebook' ? 1 : 0,
      facebookLastStreamAt: platform === 'facebook' ? now : null,
      totalLiveStreamCount: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({
    success: true,
    hasFullFeatures,
    maxViewerCount: hasFullFeatures ? 999999 : 500,
    canUseVerified: hasFullFeatures,
  });
});

export default app;
```

## PayPal Webhook Route

### `src/routes/webhooks.ts`

```typescript
import { Hono } from 'hono';
import { createDrizzle } from '../db/client';
import { paypalWebhooks, payments, premiumStatus } from '../db/schema';
import { eq } from 'drizzle-orm';
import { verifyWebhookSignature } from '../lib/paypal';
import { v4 as uuid } from 'uuid';
import type { Env } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

const TIER_PRICES = {
  monthly: 4.99,
  yearly: 29.99,
} as const;

app.post('/paypal', async (c) => {
  const db = createDrizzle(c.env.DB);
  const body = await c.req.json();
  const headers = c.req.raw.headers;

  // Extract transmission ID for replay protection
  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionTime = headers.get('paypal-transmission-time');

  if (!transmissionId) {
    return c.json({ error: 'Missing transmission ID' }, 400);
  }

  // Check if already processed (replay protection)
  const existing = await db
    .select()
    .from(paypalWebhooks)
    .where(eq(paypalWebhooks.transmissionId, transmissionId))
    .limit(1);

  if (existing.length > 0) {
    console.log('Duplicate webhook, already processed');
    return c.json({ status: 'ok' }, 200);
  }

  // Verify webhook signature
  const isValid = await verifyWebhookSignature(c.env, headers, body);
  if (!isValid) {
    console.error('Invalid webhook signature');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Sanitize data (no PII)
  const sanitizedData = {
    event_type: body.event_type,
    resource_type: body.resource_type,
    summary: body.summary,
    amount: body.resource?.amount,
    status: body.resource?.status,
  };

  // Store webhook
  await db.insert(paypalWebhooks).values({
    id: transmissionId,
    transmissionId,
    transmissionTime: transmissionTime || '',
    eventType: body.event_type,
    resourceType: body.resource_type,
    paypalOrderId: body.resource?.id,
    processed: true,
    processedAt: new Date(),
    sanitizedData,
    receivedAt: new Date(),
  });

  // Handle different event types
  if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const orderId = body.resource?.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      // Find payment
      const payment = await db
        .select()
        .from(payments)
        .where(eq(payments.paypalOrderId, orderId))
        .limit(1);

      if (payment.length > 0 && payment[0].status === 'pending') {
        // Verify amount
        const actualAmount = parseFloat(body.resource.amount.value);
        const expectedAmount = TIER_PRICES[payment[0].tier];

        if (actualAmount === expectedAmount) {
          // Calculate expiration
          const now = new Date();
          const expiresAt = new Date(now);
          if (payment[0].tier === 'monthly') {
            expiresAt.setDate(expiresAt.getDate() + 30);
          } else {
            expiresAt.setDate(expiresAt.getDate() + 365);
          }

          // Update payment
          await db
            .update(payments)
            .set({
              status: 'completed',
              paypalCaptureId: body.resource.id,
              completedAt: now,
              expiresAt,
            })
            .where(eq(payments.id, payment[0].id));

          // Grant premium
          const userId = payment[0].userId;
          const existing = await db
            .select()
            .from(premiumStatus)
            .where(eq(premiumStatus.userId, userId))
            .limit(1);

          if (existing.length > 0) {
            await db
              .update(premiumStatus)
              .set({
                isPremium: true,
                tier: payment[0].tier,
                startedAt: now,
                expiresAt,
                updatedAt: now,
              })
              .where(eq(premiumStatus.userId, userId));
          } else {
            await db.insert(premiumStatus).values({
              id: uuid(),
              userId,
              isPremium: true,
              tier: payment[0].tier,
              startedAt: now,
              expiresAt,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }
  } else if (body.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
    const orderId = body.resource?.supplementary_data?.related_ids?.order_id;

    if (orderId) {
      const payment = await db
        .select()
        .from(payments)
        .where(eq(payments.paypalOrderId, orderId))
        .limit(1);

      if (payment.length > 0) {
        // Update payment status
        await db
          .update(payments)
          .set({ status: 'refunded' })
          .where(eq(payments.id, payment[0].id));

        // Revoke premium
        await db
          .update(premiumStatus)
          .set({
            isPremium: false,
            expiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(premiumStatus.userId, payment[0].userId));
      }
    }
  }

  return c.json({ status: 'ok' }, 200);
});

export default app;
```

## Frontend Integration

### Install Dependencies

```bash
npm install @better-auth/react
npm install hono
```

### Better-auth Client Setup

```typescript
// src/app/lib/auth-client.ts
import { createAuthClient } from '@better-auth/react';

export const authClient = createAuthClient({
  baseURL: 'https://api.fakelive.app',
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  sendVerificationEmail,
} = authClient;
```

### Updated Firebase Service → Auth Service

```typescript
// src/app/services/auth.service.ts
import { Injectable, signal } from '@angular/core';
import { authClient } from '../lib/auth-client';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private session = signal<any>(null);

  constructor() {
    this.initSession();
  }

  private async initSession() {
    const session = await authClient.getSession();
    this.session.set(session.data);
  }

  async signInWithEmail(email: string, password: string) {
    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.data) {
      this.session.set(result.data);
    }

    return result;
  }

  async signUpWithEmail(email: string, password: string, name: string) {
    const result = await authClient.signUp.email({
      email,
      password,
      name,
    });

    if (result.data) {
      this.session.set(result.data);
    }

    return result;
  }

  async signInWithGoogle() {
    await authClient.signIn.social({
      provider: 'google',
    });
  }

  async signOut() {
    await authClient.signOut();
    this.session.set(null);
  }

  isAuthenticated(): boolean {
    return !!this.session()?.user;
  }

  isEmailVerified(): boolean {
    return this.session()?.user?.emailVerified === true;
  }

  getCurrentUserId(): string | null {
    return this.session()?.user?.id || null;
  }

  hasFullFeatures(): boolean {
    return this.isAuthenticated() && this.isEmailVerified();
  }
}
```

### Premium Service (Updated)

```typescript
// src/app/services/premium.service.ts
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PremiumService {
  private apiBase = 'https://api.fakelive.app';

  constructor(private auth: AuthService) {}

  async createOrder(tier: 'monthly' | 'yearly'): Promise<string> {
    const idempotencyKey = `${Date.now()}-${Math.random()}`;

    const response = await fetch(`${this.apiBase}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ tier, idempotencyKey }),
    });

    const data = await response.json();
    return data.orderId;
  }

  async captureOrder(orderId: string): Promise<boolean> {
    const response = await fetch(`${this.apiBase}/api/payments/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ orderId }),
    });

    const data = await response.json();
    return data.success;
  }

  async validateLiveStreamStart(
    platform: 'instagram' | 'tiktok' | 'facebook',
    viewerCount: number,
    isVerified: boolean
  ) {
    const response = await fetch(`${this.apiBase}/api/live-streams/validate-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ platform, viewerCount, isVerified }),
    });

    return await response.json();
  }
}
```

## Database Migrations

### Initial Migration

```sql
-- migrations/0001_initial.sql

-- Users table (Better-auth manages this)
-- Sessions table (Better-auth manages this)
-- Accounts table (Better-auth manages this)

-- Premium status
CREATE TABLE premium_status (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  is_premium INTEGER NOT NULL DEFAULT 0,
  tier TEXT,
  started_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_premium_user ON premium_status(user_id);
CREATE INDEX idx_premium_expires ON premium_status(expires_at);

-- Payments
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  paypal_order_id TEXT NOT NULL UNIQUE,
  paypal_capture_id TEXT,
  tier TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  expires_at INTEGER
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_order ON payments(paypal_order_id);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key);

-- PayPal webhooks
CREATE TABLE paypal_webhooks (
  id TEXT PRIMARY KEY,
  transmission_id TEXT NOT NULL UNIQUE,
  transmission_time TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  paypal_order_id TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  processed_at INTEGER,
  error TEXT,
  sanitized_data TEXT,
  received_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_webhooks_transmission ON paypal_webhooks(transmission_id);
CREATE INDEX idx_webhooks_order ON paypal_webhooks(paypal_order_id);

-- User stats
CREATE TABLE user_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  instagram_live_count INTEGER NOT NULL DEFAULT 0,
  instagram_last_stream_at INTEGER,
  tiktok_live_count INTEGER NOT NULL DEFAULT 0,
  tiktok_last_stream_at INTEGER,
  facebook_live_count INTEGER NOT NULL DEFAULT 0,
  facebook_last_stream_at INTEGER,
  total_live_stream_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_stats_user ON user_stats(user_id);

-- Rate limits
CREATE TABLE rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  attempted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  ip_address TEXT
);

CREATE INDEX idx_rate_limits_user_action ON rate_limits(user_id, action);
CREATE INDEX idx_rate_limits_attempted ON rate_limits(attempted_at);
```

## Security Considerations

### ✅ All Critical Security Measures Included:

1. **Payment amount verification** - Server validates from PayPal API response
2. **Idempotency** - Prevents duplicate charges with idempotency keys
3. **Webhook replay protection** - Transmission ID tracking
4. **Rate limiting** - 5 attempts per hour for payment creation
5. **Server-side enforcement** - validateLiveStreamStart endpoint
6. **Data sanitization** - No PII in webhook storage
7. **CORS** - Restricted to fakelive.app domains
8. **Authentication** - Better-auth with email verification
9. **SQL injection protection** - Drizzle ORM with parameterized queries
10. **Session security** - HTTP-only cookies via Better-auth

## 🚀 Deployment - Cloudflare Native (Recommended)

**No GitHub Actions, No GitHub Secrets - Everything in Cloudflare Dashboard!**

This guide uses Cloudflare's native GitHub integration. When you push to `main`, Cloudflare automatically builds and deploys your worker. All secrets are managed through the Cloudflare dashboard.

### Quick Summary

1. Create D1 database in Cloudflare dashboard
2. Connect your GitHub repo to Cloudflare Workers
3. Configure secrets/variables in Cloudflare dashboard
4. Push to `main` → Automatic deployment! ✅

**See `/workers/api/DEPLOYMENT.md` for complete step-by-step guide.**

### Step 1: Create D1 Database

#### 1.1 Create D1 Database

```bash
# From the monorepo root
cd workers/api
npx wrangler d1 create fakelive-app
```

This will output something like:
```
✅ Successfully created DB 'fakelive-app'

[[d1_databases]]
binding = "DB"
database_name = "fakelive-app"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id`** and update `workers/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fakelive-app"
database_id = "YOUR_ACTUAL_DATABASE_ID_HERE"  # ← Paste here
```

#### 1.2 Generate Initial Migration

```bash
# From workers/api directory
npm install
npx drizzle-kit generate:sqlite
```

This creates migration files in `src/db/migrations/`

#### 1.3 Apply Initial Migration

```bash
npx wrangler d1 migrations apply fakelive-app --remote
```

#### 1.4 Get Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Configure:
   - **Permissions:** Account > Cloudflare Workers Scripts > Edit
   - **Account Resources:** Include > Your Account
5. Click "Continue to summary" → "Create Token"
6. **Copy the token** (you'll need it for GitHub secrets)

#### 1.5 Get Account ID

1. Go to https://dash.cloudflare.com/
2. Click on "Workers & Pages"
3. Copy your **Account ID** from the right sidebar

### Step 2: Configure GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value | How to Get It |
|-------------|-------|---------------|
| `CLOUDFLARE_API_TOKEN` | Your API token | Step 1.4 above |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID | Step 1.5 above |
| `BETTER_AUTH_SECRET` | Random string (64+ chars) | Generate: `openssl rand -base64 64` |
| `PAYPAL_CLIENT_ID` | PayPal client ID | PayPal Developer Dashboard |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret | PayPal Developer Dashboard |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID | Created in Step 4 |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console |

### Step 3: Create GitHub Actions Workflow

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches:
      - main
    paths:
      - 'workers/api/**'
      - '.github/workflows/deploy-worker.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy Worker to Cloudflare

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'workers/api/package-lock.json'

      - name: Install dependencies
        working-directory: workers/api
        run: npm ci

      - name: Run database migrations
        working-directory: workers/api
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          npx wrangler d1 migrations apply fakelive-app --remote

      - name: Deploy to Cloudflare Workers
        working-directory: workers/api
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler deploy

      - name: Set secrets in Cloudflare
        working-directory: workers/api
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          echo "${{ secrets.BETTER_AUTH_SECRET }}" | npx wrangler secret put BETTER_AUTH_SECRET
          echo "${{ secrets.PAYPAL_CLIENT_ID }}" | npx wrangler secret put PAYPAL_CLIENT_ID
          echo "${{ secrets.PAYPAL_CLIENT_SECRET }}" | npx wrangler secret put PAYPAL_CLIENT_SECRET
          echo "${{ secrets.PAYPAL_WEBHOOK_ID }}" | npx wrangler secret put PAYPAL_WEBHOOK_ID
          echo "${{ secrets.GOOGLE_CLIENT_ID }}" | npx wrangler secret put GOOGLE_CLIENT_ID
          echo "${{ secrets.GOOGLE_CLIENT_SECRET }}" | npx wrangler secret put GOOGLE_CLIENT_SECRET

      - name: Deployment summary
        run: |
          echo "✅ Worker deployed to: https://api.fakelive.app"
          echo "✅ Database migrations applied"
          echo "✅ Secrets updated"
```

### Step 4: Configure Custom Domain for Worker

#### 4.1 Add Worker Route

1. Go to Cloudflare Dashboard → Your domain (fakelive.app)
2. Click "Workers Routes" in the left sidebar
3. Click "Add route"
4. Configure:
   - **Route:** `api.fakelive.app/*`
   - **Service:** `fakelive-api` (your worker name)
   - **Environment:** `production`
5. Click "Save"

#### 4.2 Add DNS Record (if not exists)

1. Go to "DNS" in the left sidebar
2. Add a new record:
   - **Type:** `AAAA`
   - **Name:** `api`
   - **IPv6 address:** `100::`
   - **Proxy status:** Proxied (orange cloud)
3. Click "Save"

Now your worker will be accessible at `https://api.fakelive.app`

### Step 5: Configure PayPal Webhook

1. Go to https://developer.paypal.com/dashboard/
2. Navigate to "Apps & Credentials"
3. Select your app
4. Scroll to "Webhooks"
5. Click "Add Webhook"
6. Configure:
   - **Webhook URL:** `https://api.fakelive.app/webhooks/paypal`
   - **Event types:** Select:
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.DENIED`
     - `PAYMENT.CAPTURE.REFUNDED`
7. Click "Save"
8. **Copy the Webhook ID** and add it to GitHub secrets as `PAYPAL_WEBHOOK_ID`

### Step 6: Local Development Setup

Create `workers/api/.dev.vars` (gitignored):

```env
# Local development environment variables
BETTER_AUTH_URL=http://localhost:8787
BETTER_AUTH_SECRET=your-local-secret-here
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Add to `workers/api/.gitignore`:

```gitignore
.dev.vars
.wrangler/
node_modules/
dist/
```

#### Run locally:

```bash
cd workers/api
npm run dev
```

This starts the worker at `http://localhost:8787`

### Step 7: Update Frontend to Use New API

Update `apps/www/src/environments/environment.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.fakelive.app',
};
```

Update `apps/www/src/environments/environment.development.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8787',
};
```

### Step 8: Test Automatic Deployment

1. Make any change to a file in `workers/api/`
2. Commit and push to main:
   ```bash
   git add .
   git commit -m "Add Cloudflare Worker for API"
   git push origin main
   ```
3. Go to GitHub → Actions tab
4. Watch the "Deploy Cloudflare Worker" workflow run
5. Once complete, test your API:
   ```bash
   curl https://api.fakelive.app/health
   ```

Expected response:
```json
{"status":"ok","timestamp":1234567890}
```

## Deployment Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  Developer pushes to main branch                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  GitHub Actions Triggered                           │
│  - Detects changes in workers/api/**                │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Install Dependencies                               │
│  - npm ci in workers/api/                           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Run Database Migrations                            │
│  - wrangler d1 migrations apply                     │
│  - Applies new schema changes to D1                 │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Deploy Worker                                      │
│  - wrangler deploy                                  │
│  - Bundles and uploads to Cloudflare               │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Update Secrets                                     │
│  - Syncs GitHub secrets to Cloudflare Worker       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  ✅ Deployment Complete                             │
│  - Worker live at api.fakelive.app                  │
│  - Database updated                                 │
│  - Ready to serve requests                          │
└─────────────────────────────────────────────────────┘
```

## Adding New Database Migrations

When you need to change the database schema:

1. **Update the schema** in `workers/api/src/db/schema.ts`

2. **Generate migration:**
   ```bash
   cd workers/api
   npx drizzle-kit generate:sqlite
   ```

3. **Test locally:**
   ```bash
   npx wrangler d1 migrations apply fakelive-app --local
   npm run dev
   ```

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add new database migration"
   git push origin main
   ```

5. **GitHub Actions automatically:**
   - Applies migration to production D1
   - Deploys updated worker
   - Your changes are live!

## Advantages Over Firebase

1. **Cost** - Cloudflare's free tier is extremely generous
2. **Performance** - Edge computing, faster response times
3. **Simplicity** - One platform for everything
4. **SQL** - Familiar database with Drizzle ORM
5. **Flexibility** - Full control over backend logic
6. **Security** - Better-auth is modern and secure
7. **Type Safety** - End-to-end TypeScript with Drizzle
