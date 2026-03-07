'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface TrackedProperty {
  id: string;
  address: string;
  jurisdiction: string | null;
  state: string | null;
  status: string | null;
  last_checked: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  yes:         { label: 'Allowed',      className: 'text-green-400 bg-green-500/10 border-green-500/30' },
  allowed:     { label: 'Allowed',      className: 'text-green-400 bg-green-500/10 border-green-500/30' },
  conditional: { label: 'Conditional',  className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  no:          { label: 'Not Allowed',  className: 'text-red-400 bg-red-500/10 border-red-500/30' },
  not_allowed: { label: 'Not Allowed',  className: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

const TIER_LIMITS = { free: 0, standard: 5, pro: 25 };

export default function DashboardPage() {
  const router = useRouter();
  const [tier, setTier] = useState<'free' | 'standard' | 'pro'>('free');
  const [properties, setProperties] = useState<TrackedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAddress, setAddAddress] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/auth/login'); return; }

      setToken(session.access_token);

      // Get tier
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', session.user.id)
        .single();
      setTier((profile?.tier as 'free' | 'standard' | 'pro') ?? 'free');

      // Load properties
      const res = await fetch('/api/properties', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProperties(data.properties ?? []);
      }
      setLoading(false);
    });
  }, [router]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!addAddress.trim() || !token) return;
    setAdding(true);
    setAddError(null);

    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ address: addAddress.trim() }),
    });
    const data = await res.json();

    if (res.ok) {
      setProperties(prev => [data.property, ...prev]);
      setAddAddress('');
    } else {
      setAddError(data.error ?? 'Failed to add property.');
    }
    setAdding(false);
  }

  async function handleRemove(id: string) {
    if (!token) return;
    await fetch(`/api/properties?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setProperties(prev => prev.filter(p => p.id !== id));
  }

  const limit = TIER_LIMITS[tier];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-white flex flex-col">
        <nav className="px-6 py-4 flex items-center justify-between border-b border-white/5">
          <a href="/" className="text-xl font-bold tracking-tight">ST<span className="text-orange-400">Regs</span>.ai</a>
        </nav>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-slate-500">Loading dashboard…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <a href="/" className="text-xl font-bold tracking-tight">ST<span className="text-orange-400">Regs</span>.ai</a>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">← Search</a>
          <a href="/account" className="text-sm text-slate-400 hover:text-white transition-colors">Account</a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Property Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Track regulation changes across your portfolio</p>
          </div>
          {tier !== 'free' && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full border
              border-white/10 text-slate-300">
              {properties.length} / {limit} properties
            </span>
          )}
        </div>

        {/* Free gate */}
        {tier === 'free' && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-3">🔒</div>
            <h2 className="text-lg font-semibold mb-2">Portfolio monitoring is a paid feature</h2>
            <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto">
              Track up to 5 properties with Standard, or 25 with Pro. Get notified when regulations change.
            </p>
            <a href="/pricing"
              className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg px-6 py-3 transition-colors">
              Upgrade to Standard →
            </a>
          </div>
        )}

        {/* Add property form */}
        {tier !== 'free' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
              Add a property
            </h2>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                value={addAddress}
                onChange={e => setAddAddress(e.target.value)}
                placeholder="123 Main St, Denver, CO 80202"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-400/50"
              />
              <button
                type="submit"
                disabled={adding || !addAddress.trim() || properties.length >= limit}
                className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </form>
            {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
            {properties.length >= limit && (
              <p className="text-slate-500 text-xs mt-2">
                {tier === 'standard'
                  ? 'Limit reached. Upgrade to Pro for up to 25 properties.'
                  : 'Portfolio limit reached (25 properties).'}
              </p>
            )}
          </div>
        )}

        {/* Properties table */}
        {tier !== 'free' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {properties.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm">
                No properties tracked yet. Add your first property above.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-slate-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Address</th>
                    <th className="text-left px-5 py-3 hidden sm:table-cell">Jurisdiction</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3 hidden md:table-cell">Last Checked</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p, i) => {
                    const badge = STATUS_BADGE[p.status ?? ''] ?? { label: 'Unknown', className: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
                    return (
                      <tr key={p.id} className={i < properties.length - 1 ? 'border-b border-white/5' : ''}>
                        <td className="px-5 py-4">
                          <a href={`/results?address=${encodeURIComponent(p.address)}`}
                            className="text-white hover:text-orange-400 transition-colors font-medium">
                            {p.address}
                          </a>
                        </td>
                        <td className="px-5 py-4 text-slate-400 hidden sm:table-cell">
                          {p.jurisdiction ?? '—'}{p.state ? `, ${p.state}` : ''}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 hidden md:table-cell text-xs">
                          {new Date(p.last_checked).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleRemove(p.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
