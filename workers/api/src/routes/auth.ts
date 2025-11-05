import { Hono } from 'hono';
import type { Env } from '../types/env';

const app = new Hono<{ Bindings: Env }>();

// Better-auth automatically handles these routes:
// - POST /sign-in/email
// - POST /sign-up/email
// - POST /sign-in/social
// - GET /session
// - POST /sign-out
// - POST /send-verification-email
// - GET /verify-email
// - GET /callback/google (OAuth callback)

// Forward all auth requests to Better-auth handler
app.all('/*', async (c) => {
  const auth = c.get('auth');

  if (!auth) {
    return c.json({ error: 'Auth not initialized' }, 500);
  }

  // Better-auth handler processes the request and returns a Response
  const response = await auth.handler(c.req.raw);
  return response;
});

export default app;
