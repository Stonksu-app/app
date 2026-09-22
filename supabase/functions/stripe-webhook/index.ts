import Stripe from 'npm:stripe@22.0.0';
import { admin, planForPrice, stripeClient } from '../_shared/billing.ts';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function syncSubscription(subscription: Stripe.Subscription, eventCreated: number) {
  const userId = subscription.metadata.user_id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const price = subscription.items.data[0]?.price;
  const plan = price ? planForPrice(price.id) : null;
  if (!userId || !plan || subscription.items.data.length !== 1) return;

  const { data: owner, error: ownerError } = await admin.from('billing_customers')
    .select('stripe_customer_id').eq('user_id', userId).maybeSingle();
  if (ownerError) throw ownerError;
  if (!owner || owner.stripe_customer_id !== customerId) {
    throw new Error(`Stripe customer ownership mismatch for subscription ${subscription.id}`);
  }

  const { data: previous, error: previousError } = await admin.from('billing_subscriptions')
    .select('stripe_subscription_id, status, last_event_created').eq('user_id', userId).maybeSingle();
  if (previousError) throw previousError;
  if (previous && previous.stripe_subscription_id !== subscription.id &&
      !['canceled', 'incomplete_expired'].includes(previous.status)) {
    // A second subscription needs manual review; never let an old cancellation
    // revoke a different active subscription's access.
    console.error('[billing] multiple subscriptions for user', userId);
    return;
  }
  if (previous?.stripe_subscription_id === subscription.id && previous.last_event_created > eventCreated) return;

  const periodEnd = subscription.items.data[0]?.current_period_end;
  const { error: billingError } = await admin.from('billing_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan,
    status: subscription.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    last_event_created: eventCreated,
    updated_at: new Date().toISOString(),
  });
  if (billingError) throw billingError;

  const entitled = ['active', 'trialing'].includes(subscription.status) &&
    (!periodEnd || periodEnd * 1000 > Date.now());
  const { error: profileError } = await admin.from('profiles').update({
    plan: entitled ? plan : 'free',
    plan_started_at: entitled ? new Date(subscription.created * 1000).toISOString() : null,
  }).eq('id', userId);
  if (profileError) throw profileError;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const signature = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !secret) return new Response('Missing signature', { status: 400 });

  try {
    const stripe = stripeClient();
    const event = await stripe.webhooks.constructEventAsync(
      await req.text(), signature, secret, undefined, cryptoProvider,
    );

    let subscription: Stripe.Subscription | null = null;
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        subscription = await stripe.subscriptions.retrieve(id);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      subscription = event.data.object as Stripe.Subscription;
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      // Fetch current state: webhook deliveries can arrive out of order.
      subscription = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
    }

    if (subscription) await syncSubscription(subscription, event.created);
    return Response.json({ received: true });
  } catch (error) {
    console.error('[billing] webhook failed', error);
    return new Response('Webhook failed', { status: 500 });
  }
});
