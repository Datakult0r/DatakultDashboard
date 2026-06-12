'use client';

import { useEffect, useState } from 'react';
import { Activity, Zap } from 'lucide-react';

interface SourceHealth {
  status: string;
  operation: string;
  items: number;
  when: string;
  error: string | null;
}

interface HealthPayload {
  ok: boolean;
  timestamp: string;
  sources: Record<string, SourceHealth>;
  pacing: { appliedToday: number; easyAppliedToday: number; easyApplyCap: number; executing: number };
  queues: { pendingApproval: number; approvedWaiting: number; readyToSend: number };
}

const SOURCE_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  calendar: 'Calendar',
  apify: 'Apify',
  claude_scoring: 'Scoring',
  claude_cv: 'CV',
  perplexity: 'News',
  firecrawl: 'Firecrawl',
  claude_content: 'Content',
  executor: 'Executor',
  dm_sweep: 'DM sweep',
};

/**
 * HealthBar — the system status surface, back on the dashboard.
 * One glance: which sources ran, which failed, how the apply pacing stands.
 * Polls /api/health every 90s.
 */
export default function HealthBar() {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok && alive) setHealth(await res.json());
      } catch { /* dashboard must never break on health */ }
    };
    load();
    const t = setInterval(load, 90000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!health) return null;

  const dotClass = (s: SourceHealth) => {
    const ageH = (new Date(health.timestamp).getTime() - new Date(s.when).getTime()) / 3600000;
    if (s.status === 'error') return 'bg-danger';
    if (s.status === 'skipped' || ageH > 26) return 'bg-warning';
    return 'bg-success';
  };

  const entries = Object.entries(health.sources);
  const { pacing } = health;

  return (
    <div className="flex items-center gap-3 overflow-x-auto py-1.5 -mx-1 px-1">
      <div className="flex items-center gap-1.5 shrink-0 text-secondary">
        <Activity size={12} />
        <span className="text-[10px] uppercase tracking-[0.15em] font-mono">Health</span>
      </div>
      {entries.length === 0 ? (
        <span className="text-xs text-secondary/60">No runs logged yet</span>
      ) : entries.map(([source, s]) => (
        <span
          key={source}
          title={`${s.operation} · ${s.items} items · ${new Date(s.when).toLocaleString()}${s.error ? `\n${s.error}` : ''}`}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-elevated/70 border border-border/60 text-[11px] text-secondary whitespace-nowrap shrink-0 cursor-default"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotClass(s)}`} />
          {SOURCE_LABELS[source] || source}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/8 border border-accent/25 text-[11px] text-accent whitespace-nowrap shrink-0 ml-auto">
        <Zap size={11} />
        {pacing.easyAppliedToday}/{pacing.easyApplyCap} LinkedIn · {pacing.appliedToday} sent today · {pacing.executing} in flight
      </span>
    </div>
  );
}
