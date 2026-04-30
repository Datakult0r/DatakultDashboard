import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/actions/run-approved
 *
 * Admin endpoint — marks all approved triage_items as 'executed' and stamps last_follow_up_at = now,
 * clearing follow_up_at. Use this when actions have been executed manually (sent the messages,
 * applied to the jobs) and you want to clear the SLA queue in bulk.
 *
 * Future v3.x: replace with real executor that dispatches via Beeper / Browser Use.
 */
export async function POST() {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseServer
      .from('triage_items')
      .update({
        action_status: 'executed',
        last_follow_up_at: nowIso,
        follow_up_at: null,
        updated_at: nowIso,
      })
      .eq('action_status', 'approved')
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, executed: data?.length ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
