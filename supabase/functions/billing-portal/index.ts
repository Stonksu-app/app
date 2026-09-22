import { admin, appOrigin, corsHeaders, response, stripeClient, verifiedUser } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== 'POST') return response(req, { error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const user = await verifiedUser(req);
    if (!user) return response(req, { error: 'UNAUTHORIZED' }, 401);
    const { data, error } = await admin.from('billing_customers')
      .select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) return response(req, { error: 'NO_BILLING_ACCOUNT' }, 404);

    const portal = await stripeClient().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${appOrigin()}/planes`,
    });
    return response(req, { url: portal.url });
  } catch (error) {
    console.error('[billing] portal failed', error);
    return response(req, { error: 'PORTAL_UNAVAILABLE' }, 503);
  }
});
