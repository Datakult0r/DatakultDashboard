import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import type { MonthlyFinance, RunwayMetrics } from '@/types/triage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/runway — computed runway metrics from monthly_finance + last buyer touch from customer_engagements. */
export async function GET() {
  try {
    const today = new Date();
    const currentMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;

    const [{ data: financeRows, error: fErr }, { data: engagementRows, error: eErr }] = await Promise.all([
      supabaseServer.from('monthly_finance').select('*').order('month', { ascending: false }).limit(6),
      supabaseServer.from('customer_engagements').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    ]);
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

    const finance = (financeRows ?? []) as MonthlyFinance[];
    const current = finance.find((r) => r.month === currentMonth);

    const trailing3 = finance.filter((r) => r.month !== currentMonth).slice(0, 3);
    const burnSum = trailing3.reduce(
      (acc, r) => acc + Math.max(0, (r.expenses_eur ?? 0) - (r.revenue_eur ?? 0)),
      0,
    );
    const trailingBurn = trailing3.length > 0 ? Math.round(burnSum / trailing3.length) : 0;

    const cashFloor = current ? (current.revenue_eur ?? 0) - (current.expenses_eur ?? 0) : 0;
    const runwayMonths = trailingBurn > 0 ? Math.max(0, Math.round((cashFloor / trailingBurn) * 10) / 10) : null;

    let daysSinceLastBuyer: number | null = null;
    const lastTouch = engagementRows?.[0]?.updated_at;
    if (lastTouch) {
      const diff = Date.now() - new Date(lastTouch).getTime();
      daysSinceLastBuyer = Math.floor(diff / 86400000);
    }

    const metrics: RunwayMetrics = {
      current_month: currentMonth,
      current_month_revenue_eur: current?.revenue_eur ?? 0,
      current_month_expenses_eur: current?.expenses_eur ?? 0,
      current_month_net_eur: cashFloor,
      trailing_3mo_avg_burn_eur: trailingBurn,
      runway_months: runwayMonths,
      cash_floor_eur: cashFloor,
      days_since_last_buyer_touch: daysSinceLastBuyer,
    };
    return NextResponse.json(metrics);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
