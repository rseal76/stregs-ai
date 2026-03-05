import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

const PRICE_IDS: Record<string, string> = {
  standard: process.env.STRIPE_STANDARD_PRICE_ID ?? '',
  pro: process.env.STRIPE_PRO_PRICE_ID ?? '',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tier: string }> }
) {
  const { tier } = await params;
  const priceId = PRICE_IDS[tier];

  if (!priceId) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.stregs.ai'}/pricing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.stregs.ai'}/pricing?cancelled=true`,
      allow_promotion_codes: true,
    });

    return NextResponse.redirect(session.url!);
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.redirect(new URL('/pricing?error=true', request.url));
  }
}
