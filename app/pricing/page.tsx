import Link from 'next/link';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try it out — no card required',
    features: [
      'STR verdict (Allowed / Conditional / Banned)',
      'Permit required Y/N',
      'Jurisdiction identified',
      'Unlimited searches',
    ],
    locked: [
      'Full regulation details',
      'Permit fees & license requirements',
      'Enforcement contacts',
      'Permit application links',
    ],
    cta: 'Start free',
    href: '/',
    highlighted: false,
    stripe: null,
  },
  {
    name: 'Standard',
    price: '$19',
    period: '/month',
    description: 'Everything you need to evaluate a property',
    features: [
      'Everything in Free',
      'Full regulation breakdown',
      'Permit fees & renewal info',
      'Primary residence & occupancy rules',
      'Enforcement body & contacts',
      'Unlimited lookups',
    ],
    locked: [
      'Direct permit application links',
      'Step-by-step action plan',
      'Regulation change alerts',
    ],
    cta: 'Get Standard',
    href: '/api/stripe/checkout?tier=standard',
    highlighted: false,
    stripe: 'standard',
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For serious investors & property managers',
    features: [
      'Everything in Standard',
      'Direct permit application links',
      'Step-by-step compliance action plan',
      'Regulation change alerts',
      'Priority support',
    ],
    locked: [],
    cta: 'Get Pro',
    href: '/api/stripe/checkout?tier=pro',
    highlighted: true,
    stripe: 'pro',
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </Link>
        <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
          ← Back to search
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3">Simple pricing</h1>
        <p className="text-slate-400 text-center mb-12">
          Know the rules before you list. Cancel anytime.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border p-6 flex flex-col ${
                tier.highlighted
                  ? 'bg-orange-500/10 border-orange-500/40 ring-1 ring-orange-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {tier.highlighted && (
                <div className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">
                  Most popular
                </div>
              )}
              <h2 className="text-xl font-bold mb-1">{tier.name}</h2>
              <p className="text-slate-400 text-sm mb-4">{tier.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-slate-400 text-sm">{tier.period}</span>
              </div>

              {/* Included features */}
              <ul className="space-y-2 mb-4 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
                {/* Locked features */}
                {tier.locked.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-600">
                    <span className="shrink-0 mt-0.5">🔒</span>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={tier.href}
                className={`block text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mt-2 ${
                  tier.highlighted
                    ? 'bg-orange-500 hover:bg-orange-400 text-white'
                    : tier.name === 'Free'
                    ? 'bg-white/8 hover:bg-white/12 text-white border border-white/10'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <p className="text-center text-slate-500 text-sm mt-10">
          Need B2B API access or bulk data?{' '}
          <a href="mailto:hello@stregs.ai" className="text-orange-400 hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </main>
  );
}
