import type { DrizzleDB } from '../db/client';
import { rateLimits } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

export async function checkRateLimit(
  db: DrizzleDB,
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
  db: DrizzleDB,
  olderThanHours: number = 24
) {
  const cutoff = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));

  await db
    .delete(rateLimits)
    .where(gt(rateLimits.attemptedAt, cutoff));
}
