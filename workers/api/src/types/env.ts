export interface Env {
  // D1 Database
  DB: D1Database;

  // Secrets (set via GitHub Actions or wrangler secret put)
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  PAYPAL_MODE: 'sandbox' | 'production';
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_WEBHOOK_ID: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}
