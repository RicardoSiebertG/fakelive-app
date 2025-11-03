# Cloudflare Native Deployment

Complete guide for deploying the FakeLive API Worker using Cloudflare's native GitHub integration - no GitHub Actions needed!

## Overview

Cloudflare Workers can automatically deploy when you push to your GitHub repository. All configuration is done through the Cloudflare dashboard.

## Setup Steps

### Step 1: Create D1 Database

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **D1**
3. Click **Create database**
4. Name: `fakelive-app`
5. Click **Create**
6. **Copy the Database ID** - you'll need this next

### Step 2: Update wrangler.toml

Update `workers/api/wrangler.toml` with your Database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fakelive-app"
database_id = "your-database-id-here"  # ← Paste your actual Database ID
```

Commit and push this change:

```bash
git add workers/api/wrangler.toml
git commit -m "Add D1 database ID"
git push origin main
```

### Step 3: Connect GitHub Repository to Cloudflare

1. Go to **Workers & Pages** → **Overview**
2. Click **Create application** → **Workers** tab
3. Click **Connect to GitHub**
4. Authorize Cloudflare to access your repositories
5. Select your `fakelive-monorepo` repository
6. Configure:
   - **Production branch:** `main`
   - **Worker name:** `fakelive-api`
   - **Root directory:** `/workers/api`

### Step 4: Configure Environment Variables & Secrets

In the Cloudflare dashboard, go to your Worker → **Settings** → **Variables**:

#### Add Variables (Public)

Click **Add variable**:

| Variable Name | Value |
|--------------|-------|
| `BETTER_AUTH_URL` | `https://api.fakelive.app` |
| `PAYPAL_MODE` | `production` (or `sandbox` for testing) |

#### Add Secrets (Encrypted)

Click **Add variable** and toggle "Encrypt":

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `BETTER_AUTH_SECRET` | Random 64+ char string | Generate: `openssl rand -base64 64` |
| `PAYPAL_CLIENT_ID` | Your PayPal client ID | PayPal Developer Dashboard |
| `PAYPAL_CLIENT_SECRET` | Your PayPal secret | PayPal Developer Dashboard |
| `PAYPAL_WEBHOOK_ID` | Your webhook ID | PayPal Developer Dashboard (after creating webhook) |
| `GOOGLE_CLIENT_ID` | Your Google client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Your Google secret | Google Cloud Console |

Click **Save and Deploy** after adding all variables.

### Step 5: Run Database Migrations

You need to run migrations manually once (Cloudflare doesn't run migrations automatically):

```bash
cd workers/api

# Install wrangler globally if you haven't
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Generate migrations from schema
npm run db:generate

# Apply migrations to production D1
wrangler d1 migrations apply fakelive-app --remote
```

### Step 6: Add Custom Domain

1. Go to your Worker → **Settings** → **Triggers**
2. Under **Custom Domains**, click **Add Custom Domain**
3. Enter: `api.fakelive.app`
4. Click **Add Custom Domain**

Cloudflare will automatically:
- Create DNS records
- Provision SSL certificate
- Route traffic to your worker

Your API will be live at: `https://api.fakelive.app` 🚀

### Step 7: Configure PayPal Webhook

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Select your app → **Webhooks**
3. Click **Add Webhook**
4. Configure:
   - **Webhook URL:** `https://api.fakelive.app/webhooks/paypal`
   - **Event types:**
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.DENIED`
     - `PAYMENT.CAPTURE.REFUNDED`
5. Click **Save**
6. **Copy the Webhook ID**
7. Go back to Cloudflare → Your Worker → **Settings** → **Variables**
8. Update the `PAYPAL_WEBHOOK_ID` secret with this value

## Automatic Deployments

Once set up, deployments are **completely automatic**:

### What Happens When You Push to Main:

```
You push code → Cloudflare detects changes → Builds worker → Deploys to edge → Live! ✅
```

Typical deployment time: **30-60 seconds**

### Viewing Deployment Status

1. Go to **Workers & Pages** → Select your worker
2. Click **Deployments** tab
3. See real-time deployment logs and status

### Rollback to Previous Version

1. Go to **Deployments** tab
2. Find a previous successful deployment
3. Click **...** → **Rollback to this deployment**

## Local Development

### 1. Install Dependencies

```bash
cd workers/api
npm install
```

### 2. Create `.dev.vars`

Create `workers/api/.dev.vars` (this is gitignored):

```env
BETTER_AUTH_URL=http://localhost:8787
BETTER_AUTH_SECRET=local-development-secret-at-least-32-chars
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Login to Wrangler

```bash
npx wrangler login
```

### 4. Run Locally

```bash
npm run dev
```

Worker runs at: `http://localhost:8787`

## Testing Your API

### Health Check

```bash
curl https://api.fakelive.app/health
```

Expected response:
```json
{"status":"ok","timestamp":1234567890}
```

### API Info

```bash
curl https://api.fakelive.app/
```

Shows all available endpoints.

## Database Management

### View Data (Drizzle Studio)

```bash
cd workers/api
npm run db:studio
```

Opens web interface at `https://local.drizzle.studio`

### Add New Migration

When you change the schema:

1. Update `src/db/schema.ts`
2. Generate migration:
   ```bash
   npm run db:generate
   ```
3. Apply to production:
   ```bash
   wrangler d1 migrations apply fakelive-app --remote
   ```
4. Commit and push:
   ```bash
   git add .
   git commit -m "Add new database migration"
   git push origin main
   ```

Cloudflare will automatically redeploy the worker.

## Monitoring

### Real-Time Logs

1. Go to your Worker → **Logs** tab
2. Click **Begin log stream**
3. See live requests and errors

### Metrics

1. Go to your Worker → **Metrics** tab
2. View:
   - Requests per second
   - Errors
   - CPU time
   - Duration

### Alerts

1. Go to **Notifications** in main dashboard
2. Click **Add**
3. Configure alerts for:
   - Error rate threshold
   - Traffic spikes
   - Worker errors

## Troubleshooting

### Worker Not Deploying

1. Check **Deployments** tab for error logs
2. Verify `wrangler.toml` is correct
3. Ensure D1 database ID matches
4. Check all required secrets are set

### Database Errors

```bash
# Verify migrations are applied
wrangler d1 migrations list fakelive-app --remote

# Check database
wrangler d1 execute fakelive-app --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Environment Variables Not Working

1. Go to **Settings** → **Variables**
2. Verify all variables/secrets are set
3. Click **Save and Deploy** after any changes
4. Wait 30-60 seconds for deployment

## Cost Estimate

Cloudflare Workers free tier includes:
- ✅ 100,000 requests/day
- ✅ 10ms CPU time per request
- ✅ Unlimited bandwidth

D1 free tier includes:
- ✅ 5 GB storage
- ✅ 5 million rows read/day
- ✅ 100,000 rows written/day

**Estimated cost for typical usage: $0/month** (within free tier)

## Migration from GitHub Actions (Optional)

If you previously set up GitHub Actions, you can keep it as a backup deployment method. The `.github/workflows/deploy-worker.yml` file can coexist with Cloudflare's native deployment.

To disable GitHub Actions:
1. Go to GitHub repo → **Settings** → **Actions**
2. Disable workflows or delete `.github/workflows/deploy-worker.yml`

## Summary

✅ **Setup once:** Create D1 database, connect GitHub, add secrets
✅ **Push to deploy:** Every push to `main` automatically deploys
✅ **No GitHub Actions needed:** Everything managed through Cloudflare
✅ **No manual steps:** Completely automatic after initial setup

Your workflow is now:
```
Write code → Commit → Push → Cloudflare auto-deploys → Done! 🎉
```
