import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDrizzle } from '../db/client';
import type { Env } from '../types/env';

export function initAuth(env: Env) {
  const db = createDrizzle(env.DB);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendVerificationEmail: async (user, url) => {
        // TODO: Implement email sending (use Resend, SendGrid, or other service)
        console.log(`Verification email for ${user.email}: ${url}`);
        // For now, just log. In production, send real emails
      },
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },

    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    // Allow requests from frontend origins
    trustedOrigins: [
      'https://fakelive.app',
      'https://www.fakelive.app',
      'http://localhost:4200', // Local development
    ],
  });
}
