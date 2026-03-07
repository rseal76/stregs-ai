'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface UserProfile {
  email: string;
  tier: 'free' | 'standard' | 'pro';
  stripe_customer_id: string | null;
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push('/auth/login');
        return;
      }

      // Fetch user profile
      const { data } = await supabase
        .from('user_profiles')
        .select('email, tier, stripe_customer_id')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setProfile(data as UserProfile);
      } else {
        // Profile might not exist yet — use auth user email
        setProfile({
          email: session.user.email || '',
          tier: 'free',
          stripe_customer_id: null,
        });
      }
      setLoading(false);
    });
  }, [router]);

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
      });

      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        alert('Could not open billing portal. Please try again.');
      }
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const tierConfig = {
    free: { label: 'Free', color: 'text-slate-400 bg-slate-500/20 border-slate-500/30' },
    standard: { label: 'Standard', color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' },
    pro: { label: 'Pro', color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' },
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-white flex flex-col">
        <nav className="px-6 py-4 flex items-center justify-between border-b border-white/5">
          <a href="/" className="text-xl font-bold tracking-tight">
            ST<span className="text-orange-400">Regs</span>.ai
          </a>
        </nav>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-slate-500">Loading account…</div>
        </div>
      </main>
    );
  }

  const tier = profile?.tier || 'free';
  const tierInfo = tierConfig[tier];

  return (
    <main className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <a href="/" className="text-xl font-bold tracking-tight">
          ST<span className="text-orange-400">Regs</span>.ai
        </a>
        <div className="flex items-center gap-4">
          <a href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
            ← Search
          </a>
          {(tier === 'standard' || tier === 'pro') && (
            <a href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">
              Dashboard
            </a>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-500 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-12 w-full">
        <h1 className="text-2xl font-bold mb-8">My Account</h1>

        {/* Plan card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Current Plan
            </h2>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${tierInfo.color}`}>
              {tierInfo.label}
            </span>
          </div>

          {tier === 'free' ? (
            <div>
              <p className="text-slate-400 text-sm mb-4">
                You&apos;re on the free plan. Upgrade to unlock full regulation details,
                compliance plans, and permit application links.
              </p>
              <a
                href="/pricing"
                className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors"
              >
                Upgrade to Standard →
              </a>
            </div>
          ) : (
            <div>
              <p className="text-slate-400 text-sm mb-4">
                You have full access to all STR regulation details, compliance action plans,
                and permit application links.
              </p>
              {profile?.stripe_customer_id && (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="inline-block bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
                >
                  {portalLoading ? 'Opening portal…' : 'Manage subscription →'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Account details */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Account Details
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Email</span>
              <span className="text-sm text-white">{profile?.email}</span>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-3">
              <span className="text-sm text-slate-400">Plan</span>
              <span className={`text-sm font-semibold ${tierInfo.color.split(' ')[0]}`}>
                {tierInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* Upgrade prompts for free users */}
        {tier === 'free' && (
          <div className="mt-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-orange-400 mb-2">What you unlock with Standard</h3>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>✓ Full regulation details (fees, caps, inspection requirements)</li>
              <li>✓ Permit application links</li>
              <li>✓ Step-by-step compliance action plan</li>
              <li>✓ Regulation change alerts</li>
            </ul>
            <a
              href="/api/stripe/checkout/standard"
              className="inline-block mt-4 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors"
            >
              Upgrade for $19/mo →
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
