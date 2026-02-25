'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface RegulationResult {
  jurisdiction: string;
  status: 'allowed' | 'conditional' | 'not_allowed';
  summary: string;
  details: {
    permitRequired: boolean;
    permitFeeAnnual: number | null;
    primaryResidenceRequired: boolean;
    ownerOccupiedRequired: boolean;
    maxDaysPerYear: number | null;
    licenseRequired: boolean;
    inspectionRequired: boolean;
    insuranceRequired: boolean;
    noiseOrdinance: boolean;
    parkingRequirements: string | null;
    occupancyLimits: string | null;
    enforcementBody: string;
    enforcementUrl: string;
  };
  source: {
    url: string;
    type: string;
    lastVerified: string;
  };
  pending: string | null;
}

// ── Mock data (Denver) — replace with live Supabase query ──────────────────
const MOCK_DENVER: RegulationResult = {
  jurisdiction: 'City of Denver',
  status: 'conditional',
  summary:
    'In Denver, short-term rentals are permitted but require a license. Your property must be your primary residence — meaning you live there at least 183 days per year. The license costs $25/year for owner-occupied units, or $100/year if you\'re renting out a non-primary property (hosted STR). There is no cap on the number of nights you can rent once licensed.',
  details: {
    permitRequired: true,
    permitFeeAnnual: 25,
    primaryResidenceRequired: true,
    ownerOccupiedRequired: false,
    maxDaysPerYear: null,
    licenseRequired: true,
    inspectionRequired: false,
    insuranceRequired: false,
    noiseOrdinance: true,
    parkingRequirements: 'No specific additional requirements beyond standard Denver code.',
    occupancyLimits: 'Maximum 2 guests per bedroom.',
    enforcementBody: 'Denver Department of Excise and Licenses',
    enforcementUrl:
      'https://www.denvergov.org/Government/Departments/Excise-and-Licenses/Licenses-and-Permits/Short-Term-Rentals',
  },
  source: {
    url: 'https://www.denvergov.org/Government/Departments/Excise-and-Licenses/Licenses-and-Permits/Short-Term-Rentals',
    type: 'City Website',
    lastVerified: 'February 2026',
  },
  pending: null,
};

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: RegulationResult['status'] }) {
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
  }[status];

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

// ── Main Results Component ─────────────────────────────────────────────────
function ResultsContent() {
  const params = useSearchParams();
  const address = params.get('address') || '';

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RegulationResult | null>(null);
  const [email, setEmail] = useState('');
  const [alertSent, setAlertSent] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallEmail, setPaywallEmail] = useState('');
  const [paywallSubmitted, setPaywallSubmitted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    // Free instant print-to-PDF
    window.print();
  }

  function handleSaveReport() {
    // $5 paid report — show paywall modal (Stripe TBD)
    setShowPaywall(true);
  }

  useEffect(() => {
    if (!address) { setLoading(false); return; }
    fetch('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.found === false) {
          setResult(null);
        } else {
          setResult(data as RegulationResult);
        }
        setLoading(false);
      })
      .catch(() => { setResult(null); setLoading(false); });
  }, [address]);

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
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-400">
          Jurisdiction not found for this address. Try a different address or{' '}
          <a href="/" className="text-orange-400 underline">
            search again
          </a>
          .
        </p>
      </div>
    );
  }

  const { details } = result;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" ref={printRef}>

      {/* $5 Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setShowPaywall(false)}>
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Save Full Report — $5</h3>
            <p className="text-slate-400 text-sm mb-4">
              Get a permanent, shareable PDF — perfect for lenders, partners, and due diligence. Includes source citations and last-verified dates.
            </p>
            {paywallSubmitted ? (
              <p className="text-green-400 text-sm text-center py-2">✅ You&apos;re on the list — we&apos;ll email you when paid reports launch.</p>
            ) : (
              <>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-4 text-center">
                  <span className="text-orange-400 text-xs font-medium">🚀 Launching soon — enter your email to be first</span>
                </div>
                <input
                  type="email" value={paywallEmail} onChange={e => setPaywallEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm mb-3 focus:outline-none focus:border-orange-400/60"
                />
                <button onClick={() => { if (paywallEmail) setPaywallSubmitted(true); }}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mb-2">
                  Notify me when it launches
                </button>
                <button onClick={() => setShowPaywall(false)} className="w-full text-slate-500 text-xs hover:text-slate-300 py-1">Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

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
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 print:bg-transparent print:border-gray-200">
          <span className="text-xs text-blue-400 font-medium print:text-gray-600">📍 Jurisdiction: {result.jurisdiction}</span>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={handleDownload}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-colors">
            ⬇ Download PDF
          </button>
          <button onClick={handleSaveReport}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded-lg px-3 py-1.5 transition-colors">
            💾 Save Report — $5
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="mb-6">
        <StatusBadge status={result.status} />
      </div>

      {/* Plain English Summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Plain English Summary
        </h2>
        <p className="text-white leading-relaxed">{result.summary}</p>
      </div>

      {/* Full Details */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Full Breakdown
        </h2>
        <DetailRow label="License required" value={details.licenseRequired ? 'Yes' : 'No'} />
        <DetailRow
          label="Annual license fee"
          value={details.permitFeeAnnual ? `$${details.permitFeeAnnual}/year` : 'No fee'}
        />
        <DetailRow
          label="Primary residence required"
          value={details.primaryResidenceRequired ? 'Yes — must be your primary home (183+ days/year)' : 'No'}
        />
        <DetailRow
          label="Nights per year cap"
          value={details.maxDaysPerYear ? `${details.maxDaysPerYear} nights/year` : 'No cap'}
        />
        <DetailRow label="Inspection required" value={details.inspectionRequired ? 'Yes' : 'No'} />
        <DetailRow label="Insurance required" value={details.insuranceRequired ? 'Yes' : 'No'} />
        <DetailRow label="Noise ordinance" value={details.noiseOrdinance ? 'Applies' : 'Not specified'} />
        <DetailRow label="Occupancy limits" value={details.occupancyLimits} />
        <DetailRow label="Parking requirements" value={details.parkingRequirements} />
        <DetailRow label="Enforcement body" value={details.enforcementBody} />
      </div>

      {/* Pending changes */}
      {result.pending && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 text-sm">
            ⚠️ <strong>Pending legislation:</strong> {result.pending}
          </p>
        </div>
      )}

      {/* Source */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 mb-8">
        <p className="text-xs text-slate-500 mb-1">Source</p>
        <a
          href={result.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 text-sm hover:underline break-all"
        >
          {result.source.url}
        </a>
        <p className="text-xs text-slate-500 mt-1">
          {result.source.type} · Last verified {result.source.lastVerified}
        </p>
      </div>

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
            onSubmit={(e) => {
              e.preventDefault();
              setAlertSent(true);
              // TODO: wire up to email capture API
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
      <nav className="px-6 py-4 border-b border-white/5">
        <a href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </a>
      </nav>
      <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading...</div>}>
        <ResultsContent />
      </Suspense>
    </main>
  );
}
