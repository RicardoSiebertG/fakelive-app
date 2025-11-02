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
  origin: ['https://fakelive.app', 'https://www.fakelive.app', 'http://localhost:4200'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Better-auth session middleware
app.use('*', async (c, next) => {
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

// Routes
app.route('/auth', authRoutes);
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
      auth: '/auth/*',
      payments: '/api/payments/*',
      liveStreams: '/api/live-streams/*',
      webhooks: '/webhooks/*',
    }
  });
});

export default app;
