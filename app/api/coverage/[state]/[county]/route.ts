import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ state: string; county: string }> }
) {
  const { state, county } = await params;
  const stateCode = state.toUpperCase();

  // county param is slug like "denver" or "el-paso" — normalize
  const countyNormalized = decodeURIComponent(county)
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s*county$/i, '')
    .trim();

  const supabase = createServerSupabaseClient();

  // Fetch all jurisdictions for this state
  const { data: jurisdictions, error } = await supabase
    .from('jurisdictions')
    .select('id, name, type, parent_county')
    .eq('state', stateCode)
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter to jurisdictions that belong to this county
  const markets = (jurisdictions || []).filter((j: any) => {
    if (j.type === 'county') {
      const jName = (j.name || '').toLowerCase().replace(/\s*county$/i, '').trim();
      return jName === countyNormalized;
    }
    if (j.parent_county) {
      const parentNorm = (j.parent_county || '')
        .split('/')[0]
        .toLowerCase()
        .replace(/\s*county$/i, '')
        .trim();
      return parentNorm === countyNormalized;
    }
    return false;
  });

  // Pretty-print county name
  const countyDisplay = countyNormalized
    .split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return NextResponse.json({
    state: stateCode,
    county: countyDisplay,
    countySlug: countyNormalized.replace(/\s+/g, '-'),
    markets: markets.map((j: any) => ({
      id: j.id,
      name: j.name,
      type: j.type,
    })),
    totalMarkets: markets.length,
  });
}
