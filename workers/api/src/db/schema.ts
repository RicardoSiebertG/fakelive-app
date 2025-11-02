import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Note: Better-auth will manage these tables automatically:
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
  userId: text('user_id').notNull().unique(),
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
  userId: text('user_id').notNull(),

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
  userId: text('user_id').notNull().unique(),

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
  userId: text('user_id').notNull(),
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
