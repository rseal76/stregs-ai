'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { NavAuth } from '@/components/NavAuth';

export default function HomePage() {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [marketCount, setMarketCount] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Fetch live market count from Supabase via /api/jurisdictions
  useEffect(() => {
    fetch('/api/jurisdictions')
      .then(r => r.json())
      .then(d => { if (d.count) setMarketCount(d.count); })
      .catch(() => {});
  }, []);

  // Debounced autocomplete fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (address.length < 4) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(address)}`);
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
        setActiveSuggestion(-1);
      } catch { /* silent fail */ }
    }, 300);
  }, [address]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setShowSuggestions(false);
    router.push(`/results?address=${encodeURIComponent(address.trim())}`);
  }

  function selectSuggestion(s: string) {
    setAddress(s);
    setSuggestions([]);
    setShowSuggestions(false);
    router.push(`/results?address=${encodeURIComponent(s)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </span>
        <div className="flex items-center gap-5">
          <a href="/coverage" className="text-sm text-slate-400 hover:text-white transition-colors">
            Coverage map
          </a>
          <a href="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
            Pricing
          </a>
          <NavAuth />
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 bg-orange-400/10 border border-orange-400/20 rounded-full px-4 py-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-xs text-orange-400 font-medium tracking-wide uppercase">
            All 50 States — Nationwide Coverage Live
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center leading-tight max-w-3xl mb-4">
          Know the rules{' '}
          <span className="text-orange-400">before you list.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-slate-400 text-center max-w-xl mb-10">
          Instant STR regulatory intelligence for any US address.
          1,100+ markets covered across all 50 states.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-xl">
          <div className="relative flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={address}
                onChange={(e) => { setAddress(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Enter any US address..."
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-orange-400/60 transition-all text-base"
              />

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-1 bg-[#1e293b] border border-white/10 rounded-xl overflow-hidden shadow-xl z-50">
                  {suggestions.map((s, i) => (
                    <li
                      key={s}
                      onMouseDown={() => selectSuggestion(s)}
                      className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                        i === activeSuggestion
                          ? 'bg-orange-500/20 text-white'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      📍 {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors whitespace-nowrap"
            >
              Look it up →
            </button>
          </div>
        </form>

        {/* Example addresses */}
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {[
            '1942 Broadway St, Nashville, TN',
            '2301 Collins Ave, Miami Beach, FL',
            '400 Broad St, Seattle, WA',
          ].map((example) => (
            <button
              key={example}
              onClick={() => selectSuggestion(example)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1 border border-white/5 rounded-full hover:border-white/10"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-wrap items-center justify-center gap-8">
          {[
            { value: '1,100+', label: 'markets nationwide' },
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
