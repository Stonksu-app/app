import { Capacitor } from '@capacitor/core';
import { supabase, isCloudEnabled } from './supabase';
import type { Plan } from '../data/plans';

/** Native store subscriptions need their own purchase flow. */
export const webBillingEnabled = isCloudEnabled && !Capacitor.isNativePlatform() &&
  import.meta.env.VITE_BILLING_ENABLED === 'true';

async function billingUrl(functionName: string, body: Record<string, unknown> = {}): Promise<string> {
  if (!supabase) throw new Error('No hay conexión con la cuenta.');
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error || typeof data?.url !== 'string' || !data.url.startsWith('https://')) {
    let code = data?.error;
    if (!code && error && 'context' in error && error.context instanceof Response) {
      const details = await error.context.json().catch(() => null);
      code = details?.error;
    }
    if (code === 'REGISTER_REQUIRED') throw new Error('Guarda tu cuenta antes de suscribirte.');
    if (code === 'ALREADY_SUBSCRIBED') throw new Error('Ya tienes una suscripción. Puedes gestionarla desde Planes.');
    throw new Error('No pudimos abrir la pasarela. Inténtalo de nuevo.');
  }
  return data.url;
}

export function checkoutUrl(plan: Exclude<Plan, 'free'>): Promise<string> {
  return billingUrl('create-checkout', { plan });
}

export function portalUrl(): Promise<string> {
  return billingUrl('billing-portal');
}
