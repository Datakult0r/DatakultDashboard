import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/health
 * The health status surface the dashboard lost. One call returns:
 * - per-source status of the latest cron run (gmail, apify, claude_scoring,
 *   perplexity, firecrawl, executor, …)
 * - execution pacing: applies today vs cap, in-flight sessions
 * - queue depths: pending approval, ready to send, your manual queue
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

    // Latest health row per source (48h window)
    const { data: healthRows } = await supabaseServer
      .from('system_health')
      .select('source, operation, status, items_count, duration_ms, error_message, created_at')
      .gte('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
      .limit(200);

    const latestBySource: Record<string, {
      status: string; operation: string; items: number; when: string; error: string | null;
    }> = {};
    for (const row of healthRows || []) {
      if (!latestBySource[row.source]) {
        latestBySource[row.source] = {
          status: row.status,
          operation: row.operation,
          items: row.items_count || 0,
          when: row.created_at,
          error: row.error_message,
        };
      }
    }

    // Pacing
    const cap = Number(process.env.DAILY_APPLY_CAP || 5);
    const { count: appliedToday } = await supabaseServer
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('applied_date', today);

    const { count: easyAppliedToday } = await supabaseServer
      .from('job_applications')
      .select('id', { count: 'exact', head: true })
      .eq('applied_date', today)
      .eq('method', 'easy_apply');

    const { count: executing } = await supabaseServer
      .from('triage_items')
      .select('id', { count: 'exact', head: true })
      .eq('action_status', 'executing');

    // Queues
    const { count: pendingApproval } = await supabaseServer
      .from('triage_items')
      .select('id', { count: 'exact', head: true })
      .eq('action_status', 'pending_review');

    const { count: approvedWaiting } = await supabaseServer
      .from('triage_items')
      .select('id', { count: 'exact', head: true })
      .eq('action_status', 'approved');

    const { data: readyRows } = await supabaseServer
      .from('triage_items')
      .select('id, action_payload')
      .eq('action_status', 'approved')
      .eq('action_type', 'apply_job_website');

    const readyToSend = (readyRows || []).filter(
      (r) => (r.action_payload as Record<string, string> | null)?.ready_to_send === 'true'
    ).length;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      sources: latestBySource,
      pacing: {
        appliedToday: appliedToday || 0,
        easyAppliedToday: easyAppliedToday || 0,
        easyApplyCap: cap,
        executing: executing || 0,
      },
      queues: {
        pendingApproval: pendingApproval || 0,
        approvedWaiting: approvedWaiting || 0,
        readyToSend,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
