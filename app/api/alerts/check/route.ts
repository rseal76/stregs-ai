import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/alerts/check
 *
 * Called by a cron job (or manually) to detect regulation changes
 * and queue notification emails.
 *
 * Flow:
 * 1. Fetch all jurisdictions with recent str_regulation updates
 * 2. Find email_subscribers who signed up for those jurisdictions
 * 3. Insert pending_alerts records for each subscriber
 * 4. Optionally trigger email sends via /api/alerts/send
 *
 * Protected: requires CRON_SECRET header to prevent abuse.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  // Find regulations updated in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: changedRegs, error: regsErr } = await supabase
    .from('str_regulations')
    .select('jurisdiction_id, updated_at')
    .gte('updated_at', since);

  if (regsErr) {
    console.error('[alerts/check] Error fetching changed regs:', regsErr);
    return NextResponse.json({ error: regsErr.message }, { status: 500 });
  }

  if (!changedRegs || changedRegs.length === 0) {
    return NextResponse.json({ checked: true, changes: 0, alerts: 0 });
  }

  // Get jurisdiction names for the changed ones
  const changedIds = changedRegs.map(r => r.jurisdiction_id);
  const { data: jurisdictions } = await supabase
    .from('jurisdictions')
    .select('id, name, state')
    .in('id', changedIds);

  const jurMap = Object.fromEntries((jurisdictions ?? []).map(j => [j.id, j]));

  // Find subscribers for these jurisdictions
  let alertsQueued = 0;
  const results: { jurisdiction: string; subscribers: number }[] = [];

  for (const reg of changedRegs) {
    const jur = jurMap[reg.jurisdiction_id];
    if (!jur) continue;

    const { data: subscribers } = await supabase
      .from('email_subscribers')
      .select('id, email, address')
      .eq('jurisdiction', jur.name);

    if (!subscribers || subscribers.length === 0) continue;

    // Queue alerts (insert into pending_alerts table)
    const alerts = subscribers.map(sub => ({
      subscriber_id: sub.id,
      email: sub.email,
      jurisdiction_name: jur.name,
      jurisdiction_state: jur.state,
      address: sub.address,
      regulation_updated_at: reg.updated_at,
    }));

    const { error: insertErr } = await supabase
      .from('pending_alerts')
      .upsert(alerts, { onConflict: 'subscriber_id,jurisdiction_name' });

    if (!insertErr) {
      alertsQueued += alerts.length;
      results.push({ jurisdiction: jur.name, subscribers: alerts.length });
    }
  }

  console.log(`[alerts/check] ${changedRegs.length} changed jurisdictions, ${alertsQueued} alerts queued`);

  return NextResponse.json({
    checked: true,
    changes: changedRegs.length,
    alerts: alertsQueued,
    results,
  });
}
