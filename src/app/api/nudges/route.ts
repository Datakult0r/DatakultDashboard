import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface Nudge {
  id: string;
  kind: 'outbound' | 'engagement_silent' | 'engagement_due' | 'finance_missing' | 'sla_breach' | 'pipeline_empty' | 'win_streak';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  body: string;
  cta?: { label: string; href?: string; goto?: 'now' | 'pipeline' | 'intake' | 'health' | 'open-outbound-form' | 'scroll-approval-queue' };
}

/**
 * GET /api/nudges
 *
 * Pure-heuristic proactive suggestions — no LLM, no Claude credits required.
 * Computes from: outbound_daily, customer_engagements, monthly_finance, sla_breaches.
 * Returns ranked list (danger > warning > info).
 */
export async function GET() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;

    const [
      { data: outboundToday },
      { data: engagements },
      { data: financeRow },
      { data: breaches },
    ] = await Promise.all([
      supabaseServer.from('outbound_daily').select('count').eq('log_date', todayStr).maybeSingle(),
      supabaseServer.from('customer_engagements').select('*'),
      supabaseServer.from('monthly_finance').select('*').eq('month', monthStart).maybeSingle(),
      supabaseServer.from('sla_breaches').select('*'),
    ]);

    const nudges: Nudge[] = [];
    const todayCount = (outboundToday?.count as number | undefined) ?? 0;
    const allEngagements = engagements ?? [];
    const activeEngagements = allEngagements.filter(
      (e) => !['won', 'lost', 'paused'].includes(e.stage),
    );

    // 1) Outbound quota — danger if 0, warning if <5, info-good if 5+
    if (todayCount === 0) {
      nudges.push({
        id: 'outbound-zero',
        kind: 'outbound',
        severity: 'danger',
        title: 'No outbound today',
        body: 'Block 9-11am to log five prospect touches. The dashboard will track them.',
        cta: { label: 'Log a touch', goto: 'open-outbound-form' },
      });
    } else if (todayCount < 5) {
      nudges.push({
        id: 'outbound-partial',
        kind: 'outbound',
        severity: 'warning',
        title: `${todayCount}/5 outbound touches today`,
        body: `${5 - todayCount} more to hit the daily quota.`,
        cta: { label: 'Log a touch', goto: 'open-outbound-form' },
      });
    }

    // 2) Engagements gone silent — active stage but no update for 5+ days
    const SILENCE_DAYS = 5;
    const cutoff = Date.now() - SILENCE_DAYS * 86400000;
    const silent = activeEngagements.filter((e) => {
      const t = new Date(e.updated_at).getTime();
      return t < cutoff;
    });
    if (silent.length > 0) {
      const top = silent.slice(0, 3).map((e) => e.company).join(', ');
      nudges.push({
        id: 'engagements-silent',
        kind: 'engagement_silent',
        severity: 'warning',
        title: `${silent.length} engagement${silent.length === 1 ? '' : 's'} gone silent`,
        body: `No update in ${SILENCE_DAYS}+ days: ${top}${silent.length > 3 ? `, +${silent.length - 3} more` : ''}.`,
        cta: { label: 'Open Pipeline', goto: 'pipeline' },
      });
    }

    // 3) Engagements with next_step overdue (already in NOW, but here as a separate nudge)
    const overdueDue = activeEngagements.filter(
      (e) => e.next_step_at && e.next_step_at <= todayStr,
    );
    if (overdueDue.length > 0) {
      nudges.push({
        id: 'engagement-due',
        kind: 'engagement_due',
        severity: 'danger',
        title: `${overdueDue.length} engagement next-step due today or overdue`,
        body: overdueDue.slice(0, 3).map((e) => `${e.company} — ${e.next_step}`).join(' · '),
        cta: { label: 'Open Pipeline', goto: 'pipeline' },
      });
    }

    // 4) SLA breaches on triage items
    const breachCount = breaches?.length ?? 0;
    if (breachCount > 0) {
      nudges.push({
        id: 'sla-breach',
        kind: 'sla_breach',
        severity: 'danger',
        title: `${breachCount} approved item${breachCount === 1 ? '' : 's'} overdue`,
        body: 'Either follow up now, or mark them executed if you handled them outside the dashboard.',
        cta: { label: 'Review queue', goto: 'scroll-approval-queue' },
      });
    }

    // 5) Finance missing for current month
    if (!financeRow || ((financeRow.revenue_eur ?? 0) === 0 && (financeRow.expenses_eur ?? 0) === 0)) {
      const monthName = today.toLocaleString('en', { month: 'long' });
      nudges.push({
        id: 'finance-missing',
        kind: 'finance_missing',
        severity: 'info',
        title: `Update ${monthName} finance`,
        body: 'Runway only reads true once revenue + expenses are entered. Click the runway chip in the header.',
      });
    }

    // 6) Pipeline empty — gentle nudge
    if (activeEngagements.length === 0) {
      nudges.push({
        id: 'pipeline-empty',
        kind: 'pipeline_empty',
        severity: 'warning',
        title: 'No active customer engagements',
        body: 'Nothing in the pipeline = no revenue. Add one — even a soft lead — to start tracking.',
        cta: { label: 'Open Pipeline', goto: 'pipeline' },
      });
    }

    // 7) Win streak — celebrate when there's been a recent win
    const recentWins = allEngagements.filter(
      (e) => e.stage === 'won' && new Date(e.updated_at).getTime() > Date.now() - 7 * 86400000,
    );
    if (recentWins.length > 0) {
      nudges.push({
        id: 'win-streak',
        kind: 'win_streak',
        severity: 'info',
        title: `${recentWins.length} deal${recentWins.length === 1 ? '' : 's'} won this week`,
        body: `Nice. Add a case study note to ${recentWins[0].company} now while it's fresh.`,
      });
    }

    // Sort: danger first, warning, info
    const order: Record<Nudge['severity'], number> = { danger: 0, warning: 1, info: 2 };
    nudges.sort((a, b) => order[a.severity] - order[b.severity]);

    return NextResponse.json({ items: nudges, generatedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
