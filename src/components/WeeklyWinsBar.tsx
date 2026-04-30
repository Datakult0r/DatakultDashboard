'use client';

import { useEffect, useState } from 'react';
import { Trophy, Send, CheckCircle2, Coins } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { WeeklyWins } from '@/types/triage';

/** Compact weekly wins bar — shown on the NOW surface to balance the perpetual-broken feel. */
export default function WeeklyWinsBar() {
  const [w, setW] = useState<WeeklyWins | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('weekly_wins').select('*').maybeSingle();
      if (!cancelled) setW((data as WeeklyWins | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!w) return null;

  const items = [
    { icon: <CheckCircle2 size={12} />, label: 'actions taken',  value: w.actions_taken,  color: 'text-accent' },
    { icon: <Send size={12} />,         label: 'outbound sent',  value: w.outbound_sent,  color: 'text-info' },
    { icon: <Trophy size={12} />,       label: 'deals won',      value: w.won_count,      color: 'text-money' },
    { icon: <Coins size={12} />,        label: 'won value',      value: `€${w.won_value_eur.toLocaleString()}`, color: 'text-money' },
  ];

  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-surface border border-border rounded-lg text-xs font-mono">
      <span className="text-[10px] uppercase tracking-[0.2em] text-tertiary">This week</span>
      {items.map((it, i) => (
        <span key={i} className={`flex items-center gap-1 ${it.color}`} title={it.label}>
          {it.icon}
          <span>{it.value}</span>
        </span>
      ))}
    </div>
  );
}
