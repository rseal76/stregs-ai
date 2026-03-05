'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DE:'Delaware', DC:'Washington D.C.',
  FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois',
  IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana',
  ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota',
  MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York',
  NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon',
  PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia',
  WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming',
};

interface Market {
  id: string;
  name: string;
  type: string;
}

interface CountyData {
  state: string;
  county: string;
  markets: Market[];
  totalMarkets: number;
}

export default function CountyCoveragePage() {
  const params = useParams();
  const stateCode = (params?.state as string)?.toUpperCase() || '';
  const countySlug = (params?.county as string) || '';

  const [data, setData] = useState<CountyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stateCode || !countySlug) return;
    fetch(`/api/coverage/${stateCode}/${countySlug}`)
      .then(r => r.json())
      .then((d: CountyData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stateCode, countySlug]);

  const stateName = STATE_NAMES[stateCode] || stateCode;
  const countyDisplay = data?.county
    ? `${data.county} County`
    : decodeURIComponent(countySlug).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' County';

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </Link>
        <Link href={`/coverage/${stateCode}`} className="text-sm text-slate-400 hover:text-white transition-colors">
          ← {stateName}
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <Link href="/coverage" className="hover:text-slate-300 transition-colors">All States</Link>
          <span>/</span>
          <Link href={`/coverage/${stateCode}`} className="hover:text-slate-300 transition-colors">{stateName}</Link>
          <span>/</span>
          <span className="text-slate-300">{countyDisplay}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-400/10 border border-orange-400/20 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-xs text-orange-400 font-medium tracking-wide uppercase">
              {stateCode} · County Coverage
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{countyDisplay}</h1>
          <p className="text-slate-400">
            {loading
              ? 'Loading coverage data...'
              : data?.totalMarkets
                ? `${data.totalMarkets} market${data.totalMarkets !== 1 ? 's' : ''} in our database. Click any city to see STR regulations.`
                : 'No city-level data for this county yet.'}
          </p>
        </div>

        {/* Cities list */}
        {!loading && data && data.markets.length > 0 && (
          <div className="space-y-3">
            {data.markets.map((market) => {
              const searchAddress = `${market.name}, ${stateCode}`;
              const resultsHref = `/results?address=${encodeURIComponent(searchAddress)}`;

              return (
                <Link
                  key={market.id}
                  href={resultsHref}
                  className="flex items-center justify-between bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/40 rounded-xl px-5 py-4 transition-colors group block"
                >
                  <div>
                    <p className="font-medium text-white group-hover:text-orange-300 transition-colors">
                      {market.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                      {market.type === 'county' ? 'County-wide regulations' : `City · ${countyDisplay}`}
                    </p>
                  </div>
                  <span className="text-orange-400 text-sm font-medium group-hover:text-orange-300 transition-colors shrink-0 ml-4">
                    View →
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && (!data || data.markets.length === 0) && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📍</div>
            <h2 className="text-white font-semibold text-lg mb-2">Not in our database yet</h2>
            <p className="text-slate-400 text-sm mb-6">
              We don&apos;t have city-level data for {countyDisplay} yet. We&apos;re expanding coverage constantly.
            </p>
            <Link
              href="/"
              className="inline-block bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
            >
              Search your address instead →
            </Link>
          </div>
        )}

        {/* CTA strip at bottom */}
        {!loading && data && data.markets.length > 0 && (
          <div className="mt-10 bg-gradient-to-r from-orange-500/10 to-orange-400/5 border border-orange-400/20 rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white text-sm">Want full regulation details?</p>
              <p className="text-slate-400 text-xs mt-0.5">
                Permit requirements, fees, max nights, licensing — all unlocked with Standard.
              </p>
            </div>
            <Link
              href="/api/stripe/checkout/standard"
              className="shrink-0 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            >
              Unlock for $19/mo
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
