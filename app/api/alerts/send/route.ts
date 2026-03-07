import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/alerts/send
 *
 * Processes the pending_alerts queue and sends emails.
 * Currently stubs to console until RESEND_API_KEY is configured.
 *
 * Wire up Resend: npm install resend, set RESEND_API_KEY in Vercel.
 */
async function sendAlertEmail(email: string, jurisdiction: string, state: string, address?: string | null): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    // Stub — log only until Resend is configured
    console.log(`[alerts/send] STUB — would email ${email}: ${jurisdiction}, ${state} regulations changed`);
    return true; // Treat as sent so queue doesn't pile up
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'STRegs.ai <alerts@stregs.ai>',
        to: [email],
        subject: `Regulation update: ${jurisdiction}, ${state}`,
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
            <h2 style="color: #f97316;">STR Regulation Update</h2>
            <p>The short-term rental regulations for <strong>${jurisdiction}, ${state}</strong> have been updated.</p>
            ${address ? `<p>You signed up to monitor: <em>${address}</em></p>` : ''}
            <p>
              <a href="https://www.stregs.ai/results?address=${encodeURIComponent(address || jurisdiction + ', ' + state)}"
                 style="background: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Updated Regulations →
              </a>
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
              You're receiving this because you signed up for change alerts on STRegs.ai.<br>
              <a href="https://www.stregs.ai" style="color: #f97316;">Unsubscribe</a>
            </p>
          </div>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  // Get unsent alerts (up to 50 per run)
  const { data: alerts, error } = await supabase
    .from('pending_alerts')
    .select('*')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!alerts || alerts.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const alert of alerts) {
    const ok = await sendAlertEmail(
      alert.email,
      alert.jurisdiction_name,
      alert.jurisdiction_state,
      alert.address
    );

    if (ok) {
      await supabase
        .from('pending_alerts')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', alert.id);
      sent++;
    }
  }

  console.log(`[alerts/send] Sent ${sent}/${alerts.length} alerts`);
  return NextResponse.json({ sent, total: alerts.length });
}
