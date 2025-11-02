import { Hono } from 'hono';
import type { Env } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

// Better-auth automatically handles these routes:
// - POST /auth/sign-in/email
// - POST /auth/sign-up/email
// - POST /auth/sign-in/social
// - GET /auth/session
// - POST /auth/sign-out
// - POST /auth/send-verification-email
// - GET /auth/verify-email

// We just need to forward requests to the auth instance
app.all('/*', async (c) => {
  const auth = c.get('auth');

  if (!auth) {
    return c.json({ error: 'Auth not initialized' }, 500);
  }

  // Better-auth will handle the request
  return auth.handler(c.req.raw);
});

export default app;
