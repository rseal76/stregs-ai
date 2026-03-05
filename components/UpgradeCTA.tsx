'use client';

import { useState } from 'react';

interface UpgradeCTAProps {
  hiddenFields?: number;
  totalFields?: number;
  /** Pre-filled user email for checkout */
  email?: string;
}

export default function UpgradeCTA({
  hiddenFields = 8,
  totalFields = 10,
  email,
}: UpgradeCTAProps) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade(tier: 'standard' | 'pro') {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Unable to start checkout. Please try again.');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const visibleFields = totalFields - hiddenFields;

  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-orange-400/5 border border-orange-500/30 rounded-2xl p-6 my-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl leading-none mt-0.5">🔒</span>
        <div>
          <h3 className="text-lg font-bold text-white mb-0.5">Full Report Locked</h3>
          <p className="text-slate-400 text-sm">
            You&apos;re seeing{' '}
            <span className="text-white font-semibold">{visibleFields} of {totalFields}</span> data
            points for this address.
          </p>
        </div>
      </div>

      {/* Feature list */}
      <div className="bg-black/20 rounded-xl p-4 mb-5">
        <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3">
          Standard ($19/mo) includes:
        </p>
        <ul className="space-y-2">
          {[
            'Permit fees and annual costs',
            'Primary residence requirements',
            'Night caps and seasonal limits',
            'Zoning and district restrictions',
            'Enforcement contact info',
            'Plain-English action summary',
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
              <span className="text-orange-400 shrink-0">•</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handleUpgrade('standard')}
          disabled={loading}
          className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-pulse">Loading…</span>
          ) : (
            <>
              Upgrade to Standard — $19/mo
              <span>→</span>
            </>
          )}
        </button>
        <a
          href="/pricing"
          className="flex-1 text-center bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white font-medium rounded-xl px-5 py-3 text-sm transition-colors"
        >
          Compare plans
        </a>
      </div>

      {/* Pro upsell note */}
      <p className="text-xs text-slate-500 text-center mt-3">
        Need permit application links?{' '}
        <button
          onClick={() => handleUpgrade('pro')}
          disabled={loading}
          className="text-orange-400 hover:text-orange-300 underline"
        >
          Pro ($49/mo)
        </button>{' '}
        includes direct permit links + action plans.
      </p>
    </div>
  );
}
