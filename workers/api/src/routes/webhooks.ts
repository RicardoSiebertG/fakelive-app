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
