import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { SubscriptionTier } from '@/lib/stripe';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe subscription lifecycle events:
 * - checkout.session.completed  → links Stripe customer to user_profiles by email; upgrades tier
 * - customer.subscription.created / updated → updates tier
 * - customer.subscription.deleted → downgrades to 'free'
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[webhook] Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpsert(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Maps a Stripe Price ID to a subscription tier.
 */
function priceToTier(priceId: string): SubscriptionTier {
  const standardPriceId = process.env.STRIPE_STANDARD_PRICE_ID;
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;

  if (priceId === proPriceId) return 'pro';
  if (priceId === standardPriceId) return 'standard';
  return 'free';
}

/**
 * checkout.session.completed:
 * Get customer email from Stripe, find matching user in user_profiles by email,
 * update their tier and stripe_customer_id.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const email = session.customer_details?.email ?? session.customer_email ?? '';

  if (!customerId || !email) {
    console.warn('[webhook] checkout.session.completed: missing customerId or email');
    return;
  }

  // Determine tier from subscription line items (if available)
  let tier: SubscriptionTier = 'standard'; // default to standard on checkout completion
  if (session.line_items?.data?.[0]?.price?.id) {
    tier = priceToTier(session.line_items.data[0].price.id);
  } else if (session.metadata?.tier) {
    const t = session.metadata.tier as string;
    if (t === 'pro' || t === 'standard') tier = t;
  }

  const supabase = createServerSupabaseClient();

  // Find the user by email in user_profiles
  const { data: existing, error: findError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (findError || !existing) {
    console.warn(`[webhook] No user_profile found for email ${email}. Will upsert if userId in metadata.`);

    // If userId is in metadata (from our checkout flow), upsert directly
    const userId = session.metadata?.userId;
    if (userId) {
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          { id: userId, email, stripe_customer_id: customerId, tier },
          { onConflict: 'id' }
        );
      if (error) console.error('[webhook] Upsert by userId error:', error);
    }
    return;
  }

  // Update the existing profile
  const { error } = await supabase
    .from('user_profiles')
    .update({ stripe_customer_id: customerId, tier })
    .eq('id', existing.id);

  if (error) {
    console.error('[webhook] Update user_profiles error:', error);
  } else {
    console.log(`[webhook] Updated user_profiles for ${email}: tier=${tier}, customerId=${customerId}`);
  }
}

/**
 * subscription.created / updated:
 * Updates user tier based on active price.
 */
async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const status = subscription.status;

  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const tier: SubscriptionTier = (status === 'active' || status === 'trialing')
    ? priceToTier(priceId)
    : 'free';

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('user_profiles')
    .update({ tier, stripe_customer_id: customerId })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('[webhook] handleSubscriptionUpsert error:', error);
  } else {
    console.log(`[webhook] Updated tier for customer ${customerId}: tier=${tier}, status=${status}`);
  }
}

/**
 * subscription.deleted:
 * Downgrades user to free tier.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('user_profiles')
    .update({ tier: 'free' })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('[webhook] handleSubscriptionDeleted error:', error);
  } else {
    console.log(`[webhook] Downgraded customer ${customerId} to free`);
  }
}
