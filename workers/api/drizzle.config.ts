import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    wranglerConfigPath: 'wrangler.toml',
    databaseId: '14dc19a3-30df-4a41-8197-4042edaa087e',
  },
} satisfies Config;
