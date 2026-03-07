import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const TIER_LIMITS: Record<string, number> = {
  free: 0,
  standard: 5,
  pro: 25,
};

async function getUserFromToken(token: string | null) {
  if (!token) return null;
  const supabase = createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function getUserTier(userId: string): Promise<'free' | 'standard' | 'pro'> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('tier')
    .eq('id', userId)
    .single();
  const tier = data?.tier;
  if (tier === 'standard' || tier === 'pro') return tier;
  return 'free';
}

// GET /api/properties — list user's tracked properties
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('tracked_properties')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ properties: data ?? [] });
}

// POST /api/properties — add a tracked property
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = await getUserTier(user.id);
  const limit = TIER_LIMITS[tier] ?? 0;
  if (limit === 0) {
    return NextResponse.json({ error: 'Upgrade to Standard or Pro to track properties.' }, { status: 403 });
  }

  const supabase = createServerSupabaseClient();

  // Check current count
  const { count } = await supabase
    .from('tracked_properties')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((count ?? 0) >= limit) {
    return NextResponse.json({
      error: `You've reached your ${limit}-property limit. ${tier === 'standard' ? 'Upgrade to Pro for up to 25 properties.' : ''}`,
    }, { status: 403 });
  }

  const { address } = await req.json();
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  // Lookup regulation data for this address
  const lookupRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const lookup = await lookupRes.json();

  const { data, error } = await supabase
    .from('tracked_properties')
    .insert({
      user_id: user.id,
      address,
      jurisdiction: lookup.jurisdiction ?? null,
      state: lookup.state ?? null,
      status: lookup.status ?? null,
      last_checked: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ property: data });
}

// DELETE /api/properties?id=xxx — remove a tracked property
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('tracked_properties')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
