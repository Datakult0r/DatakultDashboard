'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';
import type { Nudge } from '@/app/api/nudges/route';

/**
 * NudgesPanel — heuristic-based proactive suggestions.
 * No Claude required; computed from outbound_daily, engagements, finance, sla_breaches.
 */
export default function NudgesPanel() {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const reload = async () => {
      try {
        const r = await fetch('/api/nudges');
        if (!r.ok) {
          if (!cancelled) setNudges([]);
          return;
        }
        const data = await r.json();
        if (!cancelled) setNudges((data.items ?? []) as Nudge[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    reload();
    // Refresh every 60 seconds
    const t = setInterval(reload, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (loading || nudges.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb size={12} className="text-money" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-secondary">
            Daily nudges · {nudges.length}
          </span>
        </div>
        <span className="text-[10px] text-tertiary/70 italic hidden sm:block">
          Heuristic suggestions based on today&apos;s activity
        </span>
      </div>
      <ul className="divide-y divide-border/40">
        {nudges.slice(0, 5).map((n) => (
          <NudgeRow key={n.id} nudge={n} />
        ))}
      </ul>
    </div>
  );
}

function NudgeRow({ nudge }: { nudge: Nudge }) {
  const tone =
    nudge.severity === 'danger'
      ? { Icon: AlertTriangle, dot: 'bg-danger', text: 'text-danger' }
      : nudge.severity === 'warning'
        ? { Icon: AlertCircle, dot: 'bg-warning', text: 'text-warning' }
        : { Icon: Info, dot: 'bg-info', text: 'text-info' };
  const { Icon, dot, text } = tone;

  const handleCta = () => {
    if (nudge.cta?.href) {
      window.open(nudge.cta.href, '_blank');
      return;
    }
    if (!nudge.cta?.goto) return;
    const detail = nudge.cta.goto;
    // Special action events that components opt into:
    if (detail === 'open-outbound-form') {
      window.dispatchEvent(new CustomEvent('control-tower:open-outbound-form'));
      window.dispatchEvent(new CustomEvent('control-tower:goto', { detail: 'now' }));
      return;
    }
    if (detail === 'scroll-approval-queue') {
      window.dispatchEvent(new CustomEvent('control-tower:scroll-approval-queue'));
      window.dispatchEvent(new CustomEvent('control-tower:goto', { detail: 'now' }));
      return;
    }
    // Fallback: surface switch (e.g. 'pipeline')
    window.dispatchEvent(new CustomEvent('control-tower:goto', { detail }));
  };

  return (
    <li className="px-3 py-2 hover:bg-elevated/30 transition-colors">
      <div className="flex items-start gap-3">
        <span className={`block w-1.5 h-1.5 rounded-full mt-2 ${dot} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon size={12} className={text} />
            <span className="text-sm font-semibold text-primary">{nudge.title}</span>
          </div>
          <p className="text-xs text-secondary mt-0.5">{nudge.body}</p>
        </div>
        {nudge.cta && (
          <button
            onClick={handleCta}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-colors flex-shrink-0
              ${text} border-current/30 hover:bg-current/10`}
          >
            {nudge.cta.label}
            <ArrowRight size={10} />
          </button>
        )}
      </div>
    </li>
  );
}
