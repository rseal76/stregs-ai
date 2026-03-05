import { NextRequest, NextResponse } from 'next/server';
import { stripe, PRICE_IDS } from '@/lib/stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/stripe/checkout
 * Body: { tier: 'standard' | 'pro', userId?: string, email?: string }
 *
 * Creates a Stripe Checkout Session and returns the URL.
 * The client redirects the user to Stripe-hosted checkout.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tier, userId, email } = body as {
      tier?: 'standard' | 'pro';
      userId?: string;
      email?: string;
    };

    if (!tier || !PRICE_IDS[tier]) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be "standard" or "pro".' },
        { status: 400 }
      );
    }

    // Look up or create Stripe customer
    let stripeCustomerId: string | undefined;

    if (userId) {
      try {
        const supabase = createServerSupabaseClient();
        const { data: user } = await supabase
          .from('users')
          .select('stripe_customer_id')
          .eq('id', userId)
          .single();
        stripeCustomerId = user?.stripe_customer_id ?? undefined;
      } catch {
        // Supabase not configured yet — continue without customer ID
      }
    }

    // If no existing customer, create one
    if (!stripeCustomerId && email) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: userId ?? '' },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to Supabase if we have a userId
      if (userId) {
        try {
          const supabase = createServerSupabaseClient();
          await supabase
            .from('users')
            .upsert({ id: userId, email, stripe_customer_id: stripeCustomerId });
        } catch {
          // Non-fatal — webhook will also handle this
        }
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS[tier],
          quantity: 1,
        },
      ],
      customer: stripeCustomerId,
      customer_email: !stripeCustomerId ? email : undefined,
      metadata: {
        userId: userId ?? '',
        tier,
      },
      subscription_data: {
        metadata: {
          userId: userId ?? '',
          tier,
        },
      },
      success_url: `${appUrl}/dashboard?checkout=success&tier=${tier}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
