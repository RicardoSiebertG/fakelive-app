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
        eq(payments.idempotencyKey, idempotencyKey)
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

  try {
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
  } catch (error) {
    console.error('Payment creation error:', error);
    return c.json({ error: 'Failed to create payment order' }, 500);
  }
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

  try {
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
    console.error('Payment capture error:', error);
    return c.json({ error: 'Failed to capture payment' }, 500);
  }
});

export default app;
