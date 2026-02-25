import Link from 'next/link';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try it out',
    features: [
      '3 address lookups/month',
      'Basic regulation summary',
      'Source citations',
    ],
    cta: 'Get started',
    href: '/',
    highlighted: false,
  },
  {
    name: 'Host',
    price: '$99',
    period: '/year',
    description: 'For active STR hosts',
    features: [
      'Unlimited lookups',
      'Change alerts for up to 5 properties',
      'Email notifications on regulation changes',
      'Full detail breakdown',
      'Enforcement contact info',
    ],
    cta: 'Get Host Plan',
    href: '#',
    highlighted: true,
  },
  {
    name: 'Investor',
    price: '$199',
    period: '/year',
    description: 'For multi-property investors',
    features: [
      'Everything in Host',
      'Change alerts for up to 25 properties',
      'CSV data export',
      'Portfolio monitoring dashboard',
      'Priority support',
    ],
    cta: 'Get Investor Plan',
    href: '#',
    highlighted: false,
  },
  {
    name: 'Pro / PM',
    price: '$499',
    period: '/year',
    description: 'For property managers & analysts',
    features: [
      'Everything in Investor',
      'Unlimited properties',
      'Early API access',
      'Bulk lookup via CSV upload',
      'Dedicated account support',
    ],
    cta: 'Get Pro Plan',
    href: '#',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <nav className="px-6 py-4 border-b border-white/5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </Link>
      </nav>

      {/* Founding member banner */}
      <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-3 text-center">
        <p className="text-sm text-orange-300">
          🎉 <strong>Founding Member Offer:</strong> First 50 sign-ups get the Host Plan for{' '}
          <strong>$49/year</strong> — 50% off, locked in forever.{' '}
          <span className="text-orange-400 font-semibold">Limited spots remaining.</span>
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3">Simple, transparent pricing</h1>
        <p className="text-slate-400 text-center mb-12">
          Know the rules before you list. Cancel anytime.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border p-5 flex flex-col ${
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
              <div className="mb-5">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-slate-400 text-sm">{tier.period}</span>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-green-400 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={tier.href}
                className={`block text-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  tier.highlighted
                    ? 'bg-orange-500 hover:bg-orange-400 text-white'
                    : 'bg-white/8 hover:bg-white/12 text-white border border-white/10'
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* API note */}
        <div className="mt-10 text-center">
          <p className="text-slate-400 text-sm">
            Need B2B API access?{' '}
            <a href="mailto:api@stregs.ai" className="text-orange-400 hover:underline">
              Contact us
            </a>{' '}
            — starting at $500/month.
          </p>
        </div>
      </div>
    </main>
  );
}
