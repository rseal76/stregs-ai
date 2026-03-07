'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useRef } from 'react';
import { NavAuth } from '@/components/NavAuth';
import { createClient } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
interface RegulationResult {
  jurisdiction: string;
  status: 'allowed' | 'conditional' | 'not_allowed' | 'yes' | 'no' | string;
  summary: string;
  tier?: 'free' | 'standard' | 'pro';
  splitJurisdiction?: boolean;
  pending?: string | null;
  pendingLegislation?: string | null;
  details: {
    permitRequired: boolean | null;
    permitFeeAnnual: number | null;
    permitFeeOneTime: number | null;
    primaryResidenceRequired: boolean | null;
    ownerOccupiedRequired: boolean | null;
    maxDaysPerYear: number | null;
    licenseRequired: boolean | null;
    inspectionRequired: boolean | null;
    insuranceRequired: boolean | null;
    noiseOrdinance?: boolean | null;
    noiseOrdinanceApplicable?: boolean | null;
    parkingRequirements: string | null;
    occupancyLimits: string | null;
    enforcementBody: string | null;
    enforcementUrl: string | null;
    permitApplicationUrl?: string | null;
    [key: string]: unknown;
  };
  source?: {
    url: string;
    type: string;
    lastVerified: string;
  };
}

// ── Status Badge ───────────────────────────────────────────────────────────
function normalizeStatus(status: string): 'allowed' | 'conditional' | 'not_allowed' {
  if (status === 'yes' || status === 'allowed') return 'allowed';
  if (status === 'no' || status === 'not_allowed' || status === 'banned') return 'not_allowed';
  return 'conditional';
}

function StatusBadge({ status }: { status: RegulationResult['status'] }) {
  const normalized = normalizeStatus(status);
  const config = {
    allowed: {
      label: '✅ Allowed',
      bg: 'bg-green-500/15',
      border: 'border-green-500/30',
      text: 'text-green-400',
    },
    conditional: {
      label: '⚠️ Allowed with Conditions',
      bg: 'bg-yellow-500/15',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
    },
    not_allowed: {
      label: '❌ Not Allowed',
      bg: 'bg-red-500/15',
      border: 'border-red-500/30',
      text: 'text-red-400',
    },
  }[normalized];

  return (
    <div
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border ${config.bg} ${config.border}`}
    >
      <span className={`text-xl font-bold ${config.text}`}>{config.label}</span>
    </div>
  );
}

// ── Detail Row ─────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-slate-400 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{value}</span>
    </div>
  );
}

// ── Compliance Action Plan ─────────────────────────────────────────────────
function ComplianceActionPlan({
  result,
  isPaid,
}: {
  result: RegulationResult;
  isPaid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeStatus(result.status);
  const { details } = result;

  if (!isPaid) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Compliance Action Plan
            </h2>
          </div>
        </div>
        <p className="text-slate-500 text-sm mt-2 mb-3">
          A step-by-step compliance checklist tailored to this jurisdiction.
        </p>
        <a
          href="/pricing"
          className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg px-4 py-2 transition-colors"
        >
          Unlock compliance plan with Standard →
        </a>
      </div>
    );
  }

  function renderPlan() {
    if (normalized === 'allowed') {
      return (
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          <li>Verify no permit is required in your specific zone (check with {details.enforcementBody || 'local authorities'})</li>
          <li>Review any applicable noise ordinance rules for your property</li>
          <li>Confirm occupancy limits and parking rules {details.occupancyLimits ? `— limit is: ${details.occupancyLimits}` : ''}</li>
          <li>Register with your platform (Airbnb/VRBO) and configure your listing</li>
          <li>Set up tax remittance for local lodging taxes</li>
          {details.enforcementUrl && (
            <li>
              Bookmark the{' '}
              <a href={details.enforcementUrl} target="_blank" rel="noopener noreferrer"
                className="text-orange-400 hover:underline">
                {details.enforcementBody || 'enforcement body'} website
              </a>{' '}
              to monitor for regulation changes
            </li>
          )}
        </ol>
      );
    }

    if (normalized === 'conditional') {
      return (
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          {details.permitRequired && (
            <li>
              <strong className="text-white">Apply for an STR permit</strong>
              {details.permitApplicationUrl
                ? <> — <a href={details.permitApplicationUrl} target="_blank" rel="noopener noreferrer"
                    className="text-orange-400 hover:underline">apply online here</a></>
                : details.enforcementUrl
                  ? <> — contact <a href={details.enforcementUrl} target="_blank" rel="noopener noreferrer"
                      className="text-orange-400 hover:underline">{details.enforcementBody || 'local authorities'}</a></>
                  : <> — contact {details.enforcementBody || 'local authorities'}</>
              }
              {details.permitFeeAnnual && ` ($${details.permitFeeAnnual}/year)`}
            </li>
          )}
          {details.primaryResidenceRequired && (
            <li>
              <strong className="text-white">Confirm primary residence</strong> — this jurisdiction requires the property to be your primary residence (you must live there the majority of the year)
            </li>
          )}
          {details.inspectionRequired && (
            <li>
              <strong className="text-white">Schedule a property inspection</strong> before listing — required by this jurisdiction
            </li>
          )}
          {details.insuranceRequired && (
            <li>
              <strong className="text-white">Obtain STR liability insurance</strong> — required before you can legally list
            </li>
          )}
          {details.maxDaysPerYear && (
            <li>
              <strong className="text-white">Track your rental nights</strong> — you are limited to {details.maxDaysPerYear} nights per year
            </li>
          )}
          <li>Set up tax remittance for local lodging/transient occupancy taxes</li>
          <li>
            Monitor{' '}
            {details.enforcementUrl
              ? <a href={details.enforcementUrl} target="_blank" rel="noopener noreferrer"
                  className="text-orange-400 hover:underline">{details.enforcementBody || 'local regulations'}</a>
              : (details.enforcementBody || 'local regulations')
            }{' '}
            for any updates
          </li>
        </ol>
      );
    }

    // not_allowed
    return (
      <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
        <li>
          <strong className="text-white">Do not list</strong> — STRs are not currently permitted in this jurisdiction
        </li>
        <li>
          Monitor{' '}
          {details.enforcementUrl
            ? <a href={details.enforcementUrl} target="_blank" rel="noopener noreferrer"
                className="text-orange-400 hover:underline">{details.enforcementBody || 'local regulations'}</a>
            : (details.enforcementBody || 'local regulations')
          }{' '}
          for any regulation changes — rules do change
        </li>
        <li>
          <strong className="text-white">Consider adjacent markets</strong> — search nearby cities or counties on STRegs.ai for alternative opportunities
        </li>
        <li>
          <strong className="text-white">Consult a local real estate attorney</strong> about any variance, exception, or grandfathering options
        </li>
        <li>
          Sign up for our change alert below to be notified if this jurisdiction lifts its ban
        </li>
      </ol>
    );
  }

  const titleMap = {
    allowed: '✅ You\'re Clear to List',
    conditional: '⚠️ You Can List with Conditions',
    not_allowed: '❌ STRs Not Currently Permitted',
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-0.5">
            Compliance Action Plan
          </h2>
          <p className="text-xs text-slate-500">{titleMap[normalized]}</p>
        </div>
        <span className="text-slate-400 text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4">
          {renderPlan()}
        </div>
      )}
    </div>
  );
}

// ── Permit Link ────────────────────────────────────────────────────────────
function PermitSection({
  details,
  isPaid,
}: {
  details: RegulationResult['details'];
  isPaid: boolean;
}) {
  if (!details.permitRequired) return null;

  if (!isPaid) return null; // Server already hides URL; no need for anything here

  if (details.permitApplicationUrl) {
    return (
      <div className="mt-4 pt-3 border-t border-white/10">
        <a
          href={details.permitApplicationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors"
        >
          Apply for permit →
        </a>
      </div>
    );
  }

  if (details.enforcementBody || details.enforcementUrl) {
    return (
      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="text-sm text-slate-400">
          Contact{' '}
          {details.enforcementUrl
            ? <a href={details.enforcementUrl} target="_blank" rel="noopener noreferrer"
                className="text-orange-400 hover:underline">{details.enforcementBody || 'the enforcement body'}</a>
            : (details.enforcementBody || 'local authorities')
          }{' '}
          to apply for a permit.
        </p>
      </div>
    );
  }

  return null;
}

// ── Main Results Component ─────────────────────────────────────────────────
function ResultsContent() {
  const params = useSearchParams();
  const address = params.get('address') || '';

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RegulationResult | null>(null);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [alertSent, setAlertSent] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'standard' | 'pro'>('free');

  const printRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    window.print();
  }

  useEffect(() => {
    if (!address) { setLoading(false); return; }

    async function doLookup() {
      // Get auth token (if logged in)
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Fetch regulations with auth token
      try {
        const res = await fetch('/api/lookup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ address }),
        });
        const data = await res.json();

        if (data.found === false) {
          setResult(null);
          setNotFoundMessage(data.message || null);
        } else {
          setResult(data as RegulationResult);
          setUserTier(data.tier || 'free');
        }
      } catch {
        setResult(null);
      }
      setLoading(false);
    }

    doLookup();
  }, [address]);

  const isPaid = userTier === 'standard' || userTier === 'pro';

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-3" />
        <div className="h-8 bg-white/10 rounded w-3/4 mb-8" />
        <div className="h-20 bg-white/10 rounded mb-4" />
        <div className="h-40 bg-white/10 rounded mb-4" />
        <div className="h-24 bg-white/10 rounded" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center max-w-lg mx-auto">
        <div className="text-4xl mb-4">📍</div>
        <h2 className="text-white font-semibold text-lg mb-2">Not in our database yet</h2>
        <p className="text-slate-400 text-sm mb-6">
          {notFoundMessage || "We couldn't find STR regulations for that address. We're expanding coverage constantly."}
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide font-medium">What you can do</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>→ Try a nearby larger city (e.g. "Rockford, IL" instead of Byron)</li>
            <li>→ Check your county seat — county rules often apply</li>
            <li>→ <a href="/" className="text-orange-400 hover:underline">Search a different address</a></li>
          </ul>
        </div>
        <a href="/coverage" className="text-xs text-slate-500 hover:text-slate-300 underline">
          See our full coverage map →
        </a>
      </div>
    );
  }

  const { details } = result;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" ref={printRef}>
      {/* Back link */}
      <a href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6 inline-block print:hidden">
        ← New search
      </a>

      {/* Print-only header */}
      <div className="hidden print:block mb-6 pb-4 border-b border-gray-300">
        <div className="text-2xl font-bold text-gray-900">STRegs.ai</div>
        <div className="text-xs text-gray-500">stregs.ai — STR Regulatory Intelligence Report</div>
        <div className="text-xs text-gray-500 mt-1">Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>

      {/* Address */}
      <p className="text-slate-400 text-sm mb-1 print:text-gray-500">Results for</p>
      <h1 className="text-xl font-semibold text-white mb-4 print:text-gray-900">{address}</h1>

      {/* Jurisdiction + Action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 print:bg-transparent print:border-gray-200">
            <span className="text-xs text-blue-400 font-medium print:text-gray-600">📍 Jurisdiction: {result.jurisdiction}</span>
          </div>
          {/* Tier badge */}
          {userTier !== 'free' && (
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              userTier === 'pro'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            }`}>
              {userTier.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={handleDownload}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors">
            ⬇ Download PDF
          </button>
        </div>
      </div>

      {/* Split jurisdiction warning */}
      {result.splitJurisdiction && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 font-semibold text-sm mb-1">⚠️ Jurisdiction Cannot Be Confirmed From Address Alone</p>
          <p className="text-yellow-200/70 text-xs leading-relaxed">
            This ZIP code straddles multiple jurisdictions. Your parcel may fall under city regulations <em>or</em> unincorporated county rules — and those are completely different laws. Do not rely on city regulations until you confirm which jurisdiction your parcel actually sits in.
          </p>
          <a
            href="https://www.adcogov.org/assessor"
            target="_blank" rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-yellow-400 underline hover:text-yellow-300"
          >
            Look up your parcel on the county assessor site →
          </a>
        </div>
      )}

      {/* Status */}
      <div className="mb-6">
        <StatusBadge status={result.status} />
      </div>

      {/* Plain English Summary — gated for paid users */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Plain English Summary
        </h2>
        {isPaid ? (
          <p className="text-white leading-relaxed">{result.summary}</p>
        ) : (
          <div>
            <p className="text-white leading-relaxed mb-3">
              {result.status === 'allowed' && 'STRs are permitted in this jurisdiction.'}
              {result.status === 'conditional' && `STRs are allowed with conditions${result.details?.permitRequired ? ' — a permit is required' : ''}.`}
              {result.status === 'not_allowed' && 'STRs are not currently permitted in this jurisdiction.'}
              {!['allowed','conditional','not_allowed'].includes(result.status) && 'Regulations apply to this jurisdiction.'}
              {' '}Upgrade to Standard for the full breakdown including permit fees, zone restrictions, and occupancy rules.
            </p>
            <a
              href="/api/stripe/checkout/standard"
              className="inline-block text-xs bg-orange-500/20 hover:bg-orange-500 border border-orange-500/40 hover:border-orange-500 text-orange-300 hover:text-white font-medium rounded-lg px-4 py-2 transition-all"
            >
              Unlock full summary for $19/mo →
            </a>
          </div>
        )}
      </div>

      {/* Regulation Details */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Regulation Details
        </h2>

        {/* Always show these two for all tiers */}
        <DetailRow label="Permit required" value={details.permitRequired !== null ? (details.permitRequired ? 'Yes' : 'No') : null} />
        <DetailRow
          label="Primary residence required"
          value={details.primaryResidenceRequired !== null ? (details.primaryResidenceRequired ? 'Yes' : 'No') : null}
        />

        {isPaid ? (
          <>
            {/* Full details for paid users */}
            <DetailRow label="Annual permit fee" value={details.permitFeeAnnual ? `$${details.permitFeeAnnual}` : null} />
            <DetailRow label="One-time permit fee" value={details.permitFeeOneTime ? `$${details.permitFeeOneTime}` : null} />
            <DetailRow label="License required" value={details.licenseRequired !== null ? (details.licenseRequired ? 'Yes' : 'No') : null} />
            <DetailRow label="Inspection required" value={details.inspectionRequired !== null ? (details.inspectionRequired ? 'Yes' : 'No') : null} />
            <DetailRow label="Insurance required" value={details.insuranceRequired !== null ? (details.insuranceRequired ? 'Yes' : 'No') : null} />
            <DetailRow label="Owner-occupied required" value={details.ownerOccupiedRequired !== null ? (details.ownerOccupiedRequired ? 'Yes' : 'No') : null} />
            <DetailRow label="Max nights per year" value={details.maxDaysPerYear ? `${details.maxDaysPerYear} nights` : null} />
            <DetailRow label="Citywide permit cap" value={details.permitCapCitywide ? `${details.permitCapCitywide} permits` : null} />
            <DetailRow label="Noise ordinance" value={
              (details.noiseOrdinanceApplicable ?? details.noiseOrdinance) !== null
                ? ((details.noiseOrdinanceApplicable ?? details.noiseOrdinance) ? 'Yes' : 'No')
                : null
            } />
            <DetailRow label="Occupancy limits" value={details.occupancyLimits} />
            <DetailRow label="Parking requirements" value={details.parkingRequirements} />
            <DetailRow label="Enforcement body" value={details.enforcementBody} />

            {/* Permit application link */}
            <PermitSection details={details} isPaid={isPaid} />
          </>
        ) : (
          <>
            {/* Locked rows for free users */}
            {[
              'Annual permit fee',
              'Nights per year cap',
              'Inspection required',
              'Insurance required',
              'Noise ordinance',
              'Occupancy limits',
              'Parking requirements',
              'Enforcement contact',
            ].map((label) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-400">{label}</span>
                <span className="text-sm text-white font-medium blur-sm select-none">████████</span>
              </div>
            ))}

            {/* Upgrade CTA */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-400">🔒 Unlock all details with a Standard or Pro plan</p>
              <a
                href="/pricing"
                className="shrink-0 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg px-5 py-2 transition-colors whitespace-nowrap"
              >
                Unlock for $19/mo →
              </a>
            </div>
          </>
        )}
      </div>

      {/* Compliance Action Plan */}
      <ComplianceActionPlan result={result} isPaid={isPaid} />

      {/* Pending changes */}
      {(result.pending ?? result.pendingLegislation) && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 text-sm">
            ⚠️ <strong>Pending legislation:</strong> {result.pending ?? result.pendingLegislation}
          </p>
        </div>
      )}

      {/* Change alerts CTA */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Get notified when these regulations change</h2>
        <p className="text-xs text-slate-400 mb-4">
          STR regulations change. We monitor {result.jurisdiction} 24/7 and email you when anything shifts.
        </p>
        {alertSent ? (
          <p className="text-green-400 text-sm">✅ You&apos;re on the list. We&apos;ll notify you if anything changes.</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email) return;
              setAlertSent(true);
              fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email,
                  source: 'change_alert',
                  address,
                  jurisdiction: result.jurisdiction,
                }),
              }).catch(() => {});
            }}
            className="flex gap-3"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-400/60"
            />
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors whitespace-nowrap"
            >
              Alert me
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Page Export ────────────────────────────────────────────────────────────
export default function ResultsPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <a href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </a>
        <div className="flex items-center gap-4">
          <a href="/coverage" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
            Coverage
          </a>
          <a href="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
            Pricing
          </a>
          <NavAuth />
        </div>
      </nav>
      <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading...</div>}>
        <ResultsContent />
      </Suspense>
    </main>
  );
}
