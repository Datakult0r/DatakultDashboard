import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** SLA defaults per action_type, in days. v3.0: every approval gets a follow-up clock. */
const SLA_DAYS: Record<string, number> = {
  send_message: 2,
  reply_email: 2,
  apply_job_easy: 1,
  apply_job_website: 3,
  accept_connection: 1,
  review_document: 5,
};
const DEFAULT_SLA_DAYS = 3;

/** POST /api/actions/approve — Body: { id, sla_days? }. Sets action_status='approved' and follow_up_at. */
export async function POST(request: NextRequest) {
  try {
    const { id, sla_days } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

    // Look up action_type to determine the right SLA
    const { data: existing } = await supabaseServer
      .from('triage_items')
      .select('action_type')
      .eq('id', id)
      .single();

    const days = Number(sla_days) || (existing?.action_type ? SLA_DAYS[existing.action_type] : null) || DEFAULT_SLA_DAYS;
    const followUpAt = new Date(Date.now() + days * 86400000).toISOString();

    const { data, error } = await supabaseServer
      .from('triage_items')
      .update({
        action_status: 'approved',
        follow_up_at: followUpAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, item: data, sla_days: days });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
