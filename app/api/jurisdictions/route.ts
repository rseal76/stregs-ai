import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  try {
    // Get live count from Supabase
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/jurisdictions?select=count`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'count=exact',
        },
        next: { revalidate: 3600 },
      }
    );

    const countHeader = res.headers.get('content-range');
    // content-range: 0-999/1000 — extract total
    const total = countHeader ? parseInt(countHeader.split('/')[1]) : null;

    return NextResponse.json({
      count: total ?? 1000,
      lastUpdated: new Date().toISOString().split('T')[0],
    });
  } catch {
    return NextResponse.json({ count: 1000 });
  }
}
