import Stripe from 'npm:stripe@22.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

export type PaidPlan = 'premium' | 'ultra';

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

export function stripeClient(): Stripe {
  const secret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const mode = Deno.env.get('STRIPE_MODE') ?? 'test';
  if (mode !== 'test' || !secret.startsWith('sk_test_')) throw new Error('Only Stripe test mode is enabled');
  const appEnv = Deno.env.get('APP_ENV');
  if (appEnv !== 'dev' && appEnv !== 'test') throw new Error('Stripe test mode requires dev or test');
  return new Stripe(secret);
}

export function appOrigin(): string {
  const raw = Deno.env.get('APP_URL');
  if (!raw) throw new Error('APP_URL is missing');
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('APP_URL must use HTTPS');
  }
  return url.origin;
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin');
  const allowed = appOrigin();
  return {
    'Access-Control-Allow-Origin': origin === allowed ? origin : allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function response(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function verifiedUser(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export function priceId(plan: PaidPlan): string {
  const id = Deno.env.get(plan === 'premium' ? 'STRIPE_PRICE_PREMIUM' : 'STRIPE_PRICE_ULTRA');
  if (!id?.startsWith('price_')) throw new Error(`Missing Stripe price for ${plan}`);
  return id;
}

export function planForPrice(id: string): PaidPlan | null {
  if (id === priceId('premium')) return 'premium';
  if (id === priceId('ultra')) return 'ultra';
  return null;
}
