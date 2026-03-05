import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Service-role Supabase client — bypasses RLS.
 * Use in API routes that need full DB access.
 */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase env vars not configured');
  }
  return createClient(url, key);
}

/**
 * SSR-aware Supabase client — reads/writes auth cookies.
 * Use in Server Components and Route Handlers that need the current user's session.
 */
export async function createSSRClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only, safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Get the current user's tier from user_profiles.
 * Returns 'free' if not authenticated or no profile found.
 */
export async function getUserTierFromToken(token: string | null): Promise<'free' | 'standard' | 'pro'> {
  if (!token) return 'free';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Verify the JWT — use the service role client to call auth.getUser
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return 'free';

  // Look up their tier in user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier;
  if (tier === 'standard' || tier === 'pro') return tier;
  return 'free';
}
