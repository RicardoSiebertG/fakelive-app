# Cloudflare Native Deployment Summary

## Quick Start

### 1. Create D1 Database (via Cloudflare Dashboard)
- Go to Cloudflare Dashboard → Workers & Pages → D1
- Click "Create database" → Name: `fakelive-app`
- Copy the Database ID and update `workers/api/wrangler.toml`

### 2. Connect GitHub Repository
- Go to Workers & Pages → Create application → Workers
- Click "Connect to GitHub"
- Select your `fakelive-monorepo` repository
- Set root directory to `/workers/api`
- Set production branch to `main`

### 3. Configure Secrets in Cloudflare Dashboard
Go to your Worker → Settings → Variables:

**Add these secrets (encrypted):**
- `BETTER_AUTH_SECRET` - Random 64+ char string
- `PAYPAL_CLIENT_ID` - PayPal client ID
- `PAYPAL_CLIENT_SECRET` - PayPal secret
- `PAYPAL_WEBHOOK_ID` - PayPal webhook ID
- `GOOGLE_CLIENT_ID` - Google client ID
- `GOOGLE_CLIENT_SECRET` - Google secret

**Add these variables (public):**
- `BETTER_AUTH_URL` = `https://api.fakelive.app`
- `PAYPAL_MODE` = `production` (or `sandbox`)

### 4. Run Database Migrations
```bash
cd workers/api
npm install
wrangler login
npm run db:generate
wrangler d1 migrations apply fakelive-app --remote
```

### 5. Add Custom Domain
- Go to your Worker → Settings → Triggers
- Add custom domain: `api.fakelive.app`

### 6. Push to Deploy!
```bash
git push origin main
```

Cloudflare automatically builds and deploys. Done! ✅

## Automatic Deployments

Every push to `main` triggers automatic deployment:
- Build time: 20-40 seconds
- Deploy time: 10-20 seconds
- Total: ~60 seconds from push to live

## See Complete Guide

👉 **Full step-by-step instructions:** `/workers/api/DEPLOYMENT.md`

## No GitHub Actions Needed!

Everything is managed through Cloudflare's native integration:
- ✅ Automatic builds on push
- ✅ Secrets managed in Cloudflare dashboard
- ✅ Deployment logs in Cloudflare
- ✅ Rollbacks through Cloudflare
- ✅ No GitHub secrets required
- ✅ No workflow YAML files needed
