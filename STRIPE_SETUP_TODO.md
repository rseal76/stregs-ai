# Stripe Setup TODO

Everything is wired up and TypeScript-clean. Follow these steps to go live.

---

## 1. Create Stripe Account & Products

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → Products → Add product
2. Create **Standard** product:
   - Name: `STRegs Standard`
   - Price: `$19.00 / month` (recurring)
   - Copy the **Price ID** (starts with `price_...`)
3. Create **Pro** product:
   - Name: `STRegs Pro`
   - Price: `$49.00 / month` (recurring)
   - Copy the **Price ID**

---

## 2. Set Environment Variables

Add these to `.env.local` (and to your hosting platform, e.g. Vercel):

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...           # or sk_test_... for dev
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...         # from step 3
STRIPE_STANDARD_PRICE_ID=price_...      # from step 1
STRIPE_PRO_PRICE_ID=price_...           # from step 1

# App URL (used in success/cancel redirect URLs)
NEXT_PUBLIC_APP_URL=https://stregs.ai   # or http://localhost:3000 for dev

# Supabase (should already be set)
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...           # Service role key for server-side writes
```

---

## 3. Configure Stripe Webhook

### For local development:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
This prints a `whsec_...` key — set as `STRIPE_WEBHOOK_SECRET`.

### For production (Vercel / your host):
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://stregs.ai/api/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (`whsec_...`) → set as `STRIPE_WEBHOOK_SECRET`

---

## 4. Run Supabase Migration

In the Supabase SQL Editor, run:
```
supabase/migrations/002_users_stripe.sql
```

Or via CLI:
```bash
supabase db push
```

This creates the `users` table with:
- `id` (UUID, FK to auth.users)
- `email`
- `stripe_customer_id`
- `subscription_tier` ('free' | 'standard' | 'pro')
- `subscription_status`

And enables Row Level Security so users can only read their own row.

---

## 5. Configure Stripe Customer Portal

1. Stripe Dashboard → Settings → Customer Portal
2. Enable the portal
3. Configure allowed actions (cancel, upgrade/downgrade, update payment method)
4. Save settings

The `GET /api/stripe/portal?userId=<uuid>` route will now work for subscription management.

---

## 6. Connect Auth to Lookup API

Currently the lookup API accepts `{ address, userId? }`. To automatically pass the userId:

- Implement Supabase Auth on the frontend (Login/Signup pages)
- After login, pass `session.user.id` as `userId` in the lookup POST body
- The API will then look up the user's tier and gate the response accordingly

Placeholder in `/app/results/page.tsx`:
```ts
// TODO: Pass userId from session when auth is implemented
// const userId = session?.user?.id;
body: JSON.stringify({ address /*, userId */ }),
```

---

## 7. Test the Full Flow

Use Stripe test mode:
- Test card: `4242 4242 4242 4242` (any future date, any CVC)
- Test card (decline): `4000 0000 0000 0002`

Flow to test:
1. Search an address → see free (locked) result
2. Click "Upgrade to Standard" → Stripe checkout → success page
3. Webhook fires → Supabase user tier updated to 'standard'
4. Search same address (with userId) → see full Standard result
5. Test cancel → tier drops back to 'free'

---

## Files Created/Modified

| File | Description |
|------|-------------|
| `lib/stripe.ts` | Stripe client + price ID constants |
| `lib/supabase-server.ts` | Server-side Supabase client (service role) |
| `app/api/stripe/checkout/route.ts` | Creates Stripe Checkout sessions |
| `app/api/stripe/webhook/route.ts` | Handles subscription lifecycle events |
| `app/api/stripe/portal/route.ts` | Creates Customer Portal sessions |
| `app/api/lookup/route.ts` | Updated with tier-gating logic |
| `app/results/page.tsx` | Updated with Free/Standard/Pro display |
| `app/pricing/page.tsx` | Rebuilt with 3-tier pricing + Stripe checkout |
| `components/UpgradeCTA.tsx` | Locked report CTA for free users |
| `supabase/migrations/002_users_stripe.sql` | Users table + RLS policies |

---

## What Works Without Stripe Keys

- ✅ Full page/component rendering
- ✅ TypeScript compiles clean (`npx tsc --noEmit`)
- ✅ Lookup API returns tier-gated responses (defaults to 'free' tier)
- ✅ Pricing page renders with all 3 tiers
- ✅ UpgradeCTA component renders correctly
- ❌ Checkout button — needs `STRIPE_SECRET_KEY` + price IDs
- ❌ Webhook — needs `STRIPE_WEBHOOK_SECRET`
- ❌ Customer Portal — needs Stripe customer portal configured
- ❌ Paid tier lookup results — needs Supabase users table + auth session passing userId
