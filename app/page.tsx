'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [address, setAddress] = useState('');
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    router.push(`/results?address=${encodeURIComponent(address.trim())}`);
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </span>
        <a
          href="/pricing"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Pricing
        </a>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 bg-orange-400/10 border border-orange-400/20 rounded-full px-4 py-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-xs text-orange-400 font-medium tracking-wide uppercase">
            Colorado Phase 1 — Live
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center leading-tight max-w-3xl mb-4">
          Know the rules{' '}
          <span className="text-orange-400">before you list.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-slate-400 text-center max-w-xl mb-10">
          Instant STR regulatory intelligence for any address.
          Colorado to start — national expansion in progress.
        </p>

        {/* Search Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-xl flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter any Colorado address..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-orange-400/60 focus:bg-white/8 transition-all text-base"
          />
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors whitespace-nowrap"
          >
            Look it up →
          </button>
        </form>

        {/* Example addresses */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {[
            '7801 Zuni St, Denver',
            '123 Olde Town Sq, Arvada',
            '4850 W 10th Ave, Lakewood',
          ].map((example) => (
            <button
              key={example}
              onClick={() => setAddress(example)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1 border border-white/5 rounded-full hover:border-white/10"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-t border-white/5 bg-white/2">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-wrap items-center justify-center gap-8">
          {[
            { value: '10', label: 'Denver metro markets' },
            { value: 'AI-monitored', label: 'regulation changes' },
            { value: 'Always', label: 'up to date' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold text-orange-400">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
