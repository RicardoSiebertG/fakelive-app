import type { Env } from '../types/env';

const PAYPAL_API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
};

async function getAccessToken(env: Env): Promise<string> {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE];
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);

  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json<{ access_token: string }>();
  return data.access_token;
}

export async function createPayPalOrder(env: Env, params: {
  amount: number;
  currency: string;
  description: string;
  userId: string;
}) {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE];
  const accessToken = await getAccessToken(env);

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: params.userId,
        description: params.description,
        amount: {
          currency_code: params.currency,
          value: params.amount.toFixed(2),
        },
        custom_id: params.userId,
      }],
      application_context: {
        brand_name: 'FakeLive',
        return_url: 'https://fakelive.app/premium/success',
        cancel_url: 'https://fakelive.app/premium/cancel',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal create order error:', error);
    throw new Error('Failed to create PayPal order');
  }

  return await response.json();
}

export async function capturePayPalOrder(env: Env, orderId: string) {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE];
  const accessToken = await getAccessToken(env);

  const response = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal capture order error:', error);
    throw new Error('Failed to capture PayPal order');
  }

  return await response.json();
}

export async function verifyWebhookSignature(
  env: Env,
  headers: Headers,
  body: any
): Promise<boolean> {
  const base = PAYPAL_API_BASE[env.PAYPAL_MODE];
  const accessToken = await getAccessToken(env);

  const response = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: env.PAYPAL_WEBHOOK_ID,
      webhook_event: body,
    }),
  });

  if (!response.ok) {
    console.error('PayPal webhook verification failed');
    return false;
  }

  const data = await response.json<{ verification_status: string }>();
  return data.verification_status === 'SUCCESS';
}
