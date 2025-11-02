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

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!session.user.emailVerified) {
    return c.json({ error: 'Email verification required' }, 403);
  }

  await next();
}
