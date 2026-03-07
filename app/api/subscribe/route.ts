import { NextRequest, NextResponse } from 'next/server';

// ── Email Subscriber Capture ───────────────────────────────────────────────
// Stores emails from:
//   1. Results page "Get change alerts" form
//   2. "$5 Save Report" paywall modal
//
// Integration: Beehiiv API (wire up when BEEHIIV_API_KEY + BEEHIIV_PUB_ID set)
// Fallback: Log to console (dev) — replace with Supabase insert when DB is live
//
// Beehiiv docs: https://developers.beehiiv.com/docs/v2

interface SubscribeRequest {
  email: string;
  source: 'change_alert' | 'save_report' | 'general';
  address?: string;      // the STR address they looked up
  jurisdiction?: string; // the jurisdiction returned
}

async function addToBeehiiv(email: string, source: string): Promise<boolean> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !pubId) return false; // Beehiiv not configured yet

  try {
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        reactivate_existing: false,
        send_welcome_email: true,
        utm_source: 'stregs-ai',
        utm_medium: source,
        custom_fields: [{ name: 'signup_source', value: source }],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function insertToSupabase(email: string, source: string, address?: string, jurisdiction?: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  try {
    const res = await fetch(`${url}/rest/v1/email_subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ email, source, address: address ?? null, jurisdiction: jurisdiction ?? null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: Partial<SubscribeRequest> = {};
  try { body = await request.json(); } catch { /* ignore */ }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'valid_email_required' }, { status: 400 });
  }

  const source = body.source || 'general';
  console.log(`[subscribe] ${email} | source: ${source} | address: ${body.address || 'n/a'}`);

  // Try Beehiiv + Supabase in parallel
  const [beehiivOk] = await Promise.all([
    addToBeehiiv(email, source),
    insertToSupabase(email, source, body.address, body.jurisdiction),
  ]);

  return NextResponse.json({
    success: true,
    message: "You're on the list — we'll notify you when regulations change.",
  });
}
