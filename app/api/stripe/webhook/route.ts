import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { SubscriptionTier } from '@/lib/stripe';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe subscription lifecycle events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - checkout.session.completed (for initial customer linkage)
 *
 * Updates user tier in Supabase accordingly.
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
 * Falls back to 'free' if no match.
 */
function priceToTier(priceId: string): SubscriptionTier {
  const standardPriceId = process.env.STRIPE_STANDARD_PRICE_ID;
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;

  if (priceId === proPriceId) return 'pro';
  if (priceId === standardPriceId) return 'standard';
  return 'free';
}

/**
 * Handles checkout.session.completed:
 * Links the Stripe customer to the Supabase user.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const email = session.customer_details?.email ?? '';

  if (!customerId) return;

  const supabase = createServerSupabaseClient();

  // Upsert user record with customer ID
  const upsertData: Record<string, string> = {
    stripe_customer_id: customerId,
  };

  if (email) upsertData.email = email;

  if (userId) {
    await supabase
      .from('users')
      .upsert({ id: userId, ...upsertData }, { onConflict: 'id' });
  } else if (email) {
    // If no userId, try to find by email
    await supabase
      .from('users')
      .upsert({ email, ...upsertData }, { onConflict: 'email' });
  }
}

/**
 * Handles subscription created/updated:
 * Updates the user's tier and subscription status in Supabase.
 */
async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const userId = subscription.metadata?.userId;
  const status = subscription.status; // active, past_due, trialing, etc.

  // Determine tier from the first subscription item's price
  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const tier: SubscriptionTier = status === 'active' || status === 'trialing'
    ? priceToTier(priceId)
    : 'free';

  const supabase = createServerSupabaseClient();

  const updateData = {
    subscription_tier: tier,
    subscription_status: status,
    stripe_customer_id: customerId,
  };

  if (userId) {
    const { error } = await supabase
      .from('users')
      .upsert({ id: userId, ...updateData }, { onConflict: 'id' });
    if (error) console.error('[webhook] Supabase upsert error (userId):', error);
  } else {
    // Fallback: find user by stripe_customer_id
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('stripe_customer_id', customerId);
    if (error) console.error('[webhook] Supabase update error (customerId):', error);
  }

  console.log(`[webhook] Updated user ${userId ?? customerId}: tier=${tier}, status=${status}`);
}

/**
 * Handles subscription deleted:
 * Downgrades user to free tier.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const userId = subscription.metadata?.userId;

  const supabase = createServerSupabaseClient();

  const updateData = {
    subscription_tier: 'free' as SubscriptionTier,
    subscription_status: 'cancelled',
  };

  if (userId) {
    await supabase.from('users').update(updateData).eq('id', userId);
  } else {
    await supabase.from('users').update(updateData).eq('stripe_customer_id', customerId);
  }

  console.log(`[webhook] Downgraded user ${userId ?? customerId} to free`);
}
