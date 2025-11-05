import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initAuth } from './auth/better-auth';
import paymentsRoutes from './routes/payments';
import liveStreamsRoutes from './routes/live-streams';
import webhooksRoutes from './routes/webhooks';
import type { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['https://fakelive.app', 'https://www.fakelive.app', 'http://localhost:4200'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Better-auth handler - handles all auth routes at /api/auth/*
// This must be defined before the session middleware
app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return initAuth(c.env).handler(c.req.raw);
});

// Session middleware for protected API routes (not auth routes)
app.use('/api/payments/*', async (c, next) => {
  const auth = initAuth(c.env);

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    });

    c.set('session', session);
    c.set('auth', auth);
  } catch (error) {
    console.error('Session error:', error);
    c.set('session', null);
  }

  await next();
});

app.use('/api/live-streams/*', async (c, next) => {
  const auth = initAuth(c.env);

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    });

    c.set('session', session);
    c.set('auth', auth);
  } catch (error) {
    console.error('Session error:', error);
    c.set('session', null);
  }

  await next();
});

// API Routes
app.route('/api/payments', paymentsRoutes);
app.route('/api/live-streams', liveStreamsRoutes);
app.route('/webhooks', webhooksRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'FakeLive API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      payments: '/api/payments/*',
      liveStreams: '/api/live-streams/*',
      webhooks: '/webhooks/*',
    }
  });
});

export default app;
