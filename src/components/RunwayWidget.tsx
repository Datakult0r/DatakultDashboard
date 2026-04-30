'use client';

import { useEffect, useState } from 'react';
import { Coins, TrendingDown, Users, Plus, X, Save } from 'lucide-react';
import type { RunwayMetrics } from '@/types/triage';

/** Compact runway chip for the dashboard header. Pulls from /api/runway. Inline-edit on click when empty. */
export default function RunwayWidget() {
  const [m, setM] = useState<RunwayMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    try {
      const r = await fetch('/api/runway');
      if (!r.ok) throw new Error(`status ${r.status}`);
      setM((await r.json()) as RunwayMetrics);
    } catch {
      setM(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const save = async () => {
    if (!m) return;
    setSaving(true);
    try {
      await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: m.current_month,
          revenue_eur: Number(revenue) || 0,
          expenses_eur: Number(expenses) || 0,
        }),
      });
      setEditing(false);
      setRevenue('');
      setExpenses('');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-tertiary font-mono bg-elevated/40 border border-border rounded-md">
        <span className="opacity-50">Loading runway…</span>
      </div>
    );
  }

  if (!m) return null;

  // Empty-state: prompt to seed this month's numbers
  const isEmpty = m.current_month_revenue_eur === 0 && m.current_month_expenses_eur === 0;

  if (editing) {
    return (
      <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono bg-elevated/60 border border-accent/40 rounded-md animate-fade-in">
        <span className="text-tertiary">Apr:</span>
        <input
          autoFocus
          type="number"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          placeholder="rev€"
          className="w-16 bg-base border border-border rounded px-1.5 py-0.5 text-money focus:outline-none focus:border-accent"
        />
        <input
          type="number"
          value={expenses}
          onChange={(e) => setExpenses(e.target.value)}
          placeholder="exp€"
          className="w-16 bg-base border border-border rounded px-1.5 py-0.5 text-secondary focus:outline-none focus:border-accent"
        />
        <button onClick={save} disabled={saving} title="Save"
          className="p-1 text-success hover:bg-success/10 rounded">
          <Save size={11} />
        </button>
        <button onClick={() => setEditing(false)} disabled={saving} title="Cancel"
          className="p-1 text-tertiary hover:text-secondary rounded">
          <X size={11} />
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono bg-elevated/40 border border-dashed border-border rounded-md text-tertiary hover:text-accent hover:border-accent transition-colors"
        title="Seed this month's revenue + expenses to compute runway"
      >
        <Plus size={11} />
        Add this month
      </button>
    );
  }

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
    <button
      onClick={() => {
        setRevenue(String(m.current_month_revenue_eur));
        setExpenses(String(m.current_month_expenses_eur));
        setEditing(true);
      }}
      className="hidden lg:flex items-center gap-3 px-3 py-1.5 text-[11px] font-mono bg-elevated/40 border border-border rounded-md hover:border-border-strong transition-colors"
      title="Click to update this month's revenue + expenses"
    >
      <span className="flex items-center gap-1.5">
        <Coins size={12} className={revenueColor} />
        <span className={revenueColor}>€{m.current_month_revenue_eur.toLocaleString()}</span>
      </span>
      <span className="text-tertiary">·</span>
      <span className="flex items-center gap-1.5">
        <TrendingDown size={12} className={runwayColor} />
        <span className={runwayColor}>{m.runway_months === null ? '—' : `${m.runway_months}mo`}</span>
      </span>
      <span className="text-tertiary">·</span>
      <span className="flex items-center gap-1.5">
        <Users size={12} className={buyerColor} />
        <span className={buyerColor}>{m.days_since_last_buyer_touch === null ? '—' : `${m.days_since_last_buyer_touch}d`}</span>
      </span>
    </button>
  );
}
