'use client';

import { useEffect, useState } from 'react';
import { Coins, TrendingDown, Users } from 'lucide-react';
import type { RunwayMetrics } from '@/types/triage';

/** Compact runway chip for the dashboard header. Pulls from /api/runway. */
export default function RunwayWidget() {
  const [m, setM] = useState<RunwayMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/runway');
        if (!r.ok) throw new Error(`status ${r.status}`);
        const data = (await r.json()) as RunwayMetrics;
        if (!cancelled) setM(data);
      } catch {
        if (!cancelled) setM(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-secondary font-mono bg-elevated/40 border border-border rounded-md">
        <span className="opacity-50">Loading runway…</span>
      </div>
    );
  }

  if (!m) return null;

  const revenueColor = m.current_month_revenue_eur > 0 ? 'text-money' : 'text-tertiary';
  const runwayColor =
    m.runway_months === null
      ? 'text-tertiary'
      : m.runway_months < 2
        ? 'text-danger'
        : m.runway_months < 4
          ? 'text-warning'
          : 'text-success';
  const buyerColor =
    m.days_since_last_buyer_touch === null
      ? 'text-tertiary'
      : m.days_since_last_buyer_touch > 7
        ? 'text-danger'
        : m.days_since_last_buyer_touch > 3
          ? 'text-warning'
          : 'text-secondary';

  return (
    <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 text-[11px] font-mono bg-elevated/40 border border-border rounded-md">
      <span className="flex items-center gap-1.5" title="This month's revenue (EUR)">
        <Coins size={12} className={revenueColor} />
        <span className={revenueColor}>€{m.current_month_revenue_eur.toLocaleString()}</span>
      </span>
      <span className="text-border-strong">·</span>
      <span className="flex items-center gap-1.5" title="Months of runway at trailing 3-month burn">
        <TrendingDown size={12} className={runwayColor} />
        <span className={runwayColor}>
          {m.runway_months === null ? '—' : `${m.runway_months}mo`}
        </span>
      </span>
      <span className="text-border-strong">·</span>
      <span className="flex items-center gap-1.5" title="Days since the last engagement update">
        <Users size={12} className={buyerColor} />
        <span className={buyerColor}>
          {m.days_since_last_buyer_touch === null ? '—' : `${m.days_since_last_buyer_touch}d`}
        </span>
      </span>
    </div>
  );
}
