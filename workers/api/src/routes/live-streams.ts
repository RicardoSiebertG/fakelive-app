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
