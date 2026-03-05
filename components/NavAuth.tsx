'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface UserInfo {
  email: string;
  tier: 'free' | 'standard' | 'pro';
}

export function NavAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', session.user.id)
          .single();

        setUser({
          email: session.user.email || '',
          tier: (profile?.tier as UserInfo['tier']) || 'free',
        });
      }
      setLoaded(true);
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', session.user.id)
          .single();

        setUser({
          email: session.user.email || '',
          tier: (profile?.tier as UserInfo['tier']) || 'free',
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Don't render until we know the auth state
  if (!loaded) return null;

  if (!user) {
    return (
      <a
        href="/auth/login"
        className="text-sm text-slate-400 hover:text-white transition-colors"
      >
        Login
      </a>
    );
  }

  const tierColors = {
    free: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    standard: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pro: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${tierColors[user.tier]}`}
      >
        {user.tier.toUpperCase()}
      </span>
      <a
        href="/account"
        className="text-sm text-slate-400 hover:text-white transition-colors"
      >
        My Account
      </a>
    </div>
  );
}
