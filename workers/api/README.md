# FakeLive API Worker

Cloudflare Worker API for FakeLive premium payments, authentication, and live stream validation.

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **Database:** Cloudflare D1 (SQLite)
- **ORM:** Drizzle ORM
- **Auth:** Better-auth
- **Payments:** PayPal REST API

## Deployment

### Cloudflare Native (Recommended)

Use Cloudflare's built-in GitHub integration - no GitHub Actions needed!

**Quick Start:**
1. Create D1 database in Cloudflare dashboard
2. Connect GitHub repo to Cloudflare Workers
3. Configure secrets in Cloudflare dashboard
4. Push to `main` → Automatic deployment! ✅

👉 **Complete Guide:** See `DEPLOYMENT.md` in this directory

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.dev.vars`:**
   ```env
   BETTER_AUTH_URL=http://localhost:8787
   BETTER_AUTH_SECRET=local-dev-secret
   PAYPAL_MODE=sandbox
   PAYPAL_CLIENT_ID=your-sandbox-id
   PAYPAL_CLIENT_SECRET=your-sandbox-secret
   PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
   GOOGLE_CLIENT_ID=your-google-id
   GOOGLE_CLIENT_SECRET=your-google-secret
   ```

3. **Run locally:**
   ```bash
   npm run dev
   ```
   Worker runs at `http://localhost:8787`

## API Endpoints

### Health Check
- `GET /health` - Check API status

### Authentication (Better-auth)
- `POST /auth/sign-in/email` - Sign in with email/password
- `POST /auth/sign-up/email` - Sign up with email/password
- `POST /auth/sign-in/social` - Sign in with Google
- `GET /auth/session` - Get current session
- `POST /auth/sign-out` - Sign out

### Payments
- `POST /api/payments/create-order` - Create PayPal order
- `POST /api/payments/capture-order` - Capture PayPal payment

### Live Streams
- `POST /api/live-streams/validate-start` - Server-side validation

### Webhooks
- `POST /webhooks/paypal` - PayPal webhook handler

## Database Schema

See `src/db/schema.ts` for complete schema definition.

Tables:
- `premium_status` - User premium subscriptions
- `payments` - Payment records
- `paypal_webhooks` - Webhook audit log
- `user_stats` - Live stream statistics
- `rate_limits` - Rate limiting records

## Scripts

- `npm run dev` - Start local development server
- `npm run deploy` - Deploy to Cloudflare
- `npm run db:generate` - Generate migrations from schema
- `npm run db:migrate` - Apply migrations to remote D1
- `npm run db:migrate:local` - Apply migrations to local D1
- `npm run db:studio` - Open Drizzle Studio

## Security Features

- ✅ Payment amount verification
- ✅ Webhook replay protection
- ✅ Payment idempotency
- ✅ Rate limiting (5 requests/hour)
- ✅ Server-side enforcement
- ✅ CORS restrictions
- ✅ Better-auth session security

## Environment Variables

Set via GitHub Secrets or `wrangler secret put`:

- `BETTER_AUTH_SECRET` - Random 64+ character string
- `PAYPAL_CLIENT_ID` - PayPal app client ID
- `PAYPAL_CLIENT_SECRET` - PayPal app secret
- `PAYPAL_WEBHOOK_ID` - PayPal webhook ID
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret

## Documentation

See `/CLOUDFLARE_ARCHITECTURE.md` in the root directory for complete architecture documentation.
