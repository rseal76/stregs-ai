import Stripe from 'stripe';

// Lazy Stripe client — not initialized until first use, so build doesn't fail without env vars
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// Keep named export for backwards compat (lazily resolved)
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

export const PRICE_IDS = {
  standard: process.env.STRIPE_STANDARD_PRICE_ID ?? '',
  pro: process.env.STRIPE_PRO_PRICE_ID ?? '',
} as const;

export type SubscriptionTier = 'free' | 'standard' | 'pro';
