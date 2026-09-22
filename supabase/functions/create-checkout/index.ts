import { admin, appOrigin, corsHeaders, priceId, response, stripeClient, verifiedUser, type PaidPlan } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== 'POST') return response(req, { error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const user = await verifiedUser(req);
    if (!user) return response(req, { error: 'UNAUTHORIZED' }, 401);
    if (user.is_anonymous || !user.email) return response(req, { error: 'REGISTER_REQUIRED' }, 403);

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan as PaidPlan;
    if (plan !== 'premium' && plan !== 'ultra') return response(req, { error: 'INVALID_PLAN' }, 400);

    const { data: existing, error: lookupError } = await admin.from('billing_subscriptions')
      .select('status').eq('user_id', user.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && !['canceled', 'incomplete_expired'].includes(existing.status)) {
      return response(req, { error: 'ALREADY_SUBSCRIBED' }, 409);
    }

    const stripe = stripeClient();
    const stripePrice = await stripe.prices.retrieve(priceId(plan));
    const expected = plan === 'ultra' ? 699 : 299;
    if (!stripePrice.active || stripePrice.currency !== 'eur' || stripePrice.unit_amount !== expected ||
        stripePrice.recurring?.interval !== 'month' || stripePrice.recurring?.interval_count !== 1) {
      throw new Error(`Stripe price for ${plan} does not match the offer`);
    }

    let { data: customer, error: customerError } = await admin.from('billing_customers')
      .select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (customerError) throw customerError;
    if (!customer) {
      const created = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
      const result = await admin.from('billing_customers')
        .insert({ user_id: user.id, stripe_customer_id: created.id })
        .select('stripe_customer_id').single();
      if (result.error) {
        // Another checkout request may have created the mapping first.
        const reread = await admin.from('billing_customers')
          .select('stripe_customer_id').eq('user_id', user.id).single();
        if (reread.error) throw reread.error;
        customer = reread.data;
      } else {
        customer = result.data;
      }
    }

    const origin = appOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.stripe_customer_id,
      client_reference_id: user.id,
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${origin}/planes?checkout=success`,
      cancel_url: `${origin}/planes?checkout=cancel`,
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return response(req, { url: session.url });
  } catch (error) {
    console.error('[billing] create-checkout failed', error);
    return response(req, { error: 'CHECKOUT_UNAVAILABLE' }, 503);
  }
});
