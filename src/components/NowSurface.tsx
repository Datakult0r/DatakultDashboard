'use client';

import { useEffect, useState } from 'react';
import { Zap, ExternalLink, Check, X, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { NextAction } from '@/types/triage';
import SLABadge from './SLABadge';

interface NowSurfaceProps {
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  /** Optional callback when the user marks a follow-up done. */
  onMarkFollowedUp?: (id: string) => Promise<void>;
}

/**
 * NowSurface — the single most important next action, plus 3 follow-ups.
 * Reads next_actions view (composite ranked) directly via Supabase.
 */
export default function NowSurface({ onApprove, onReject, onMarkFollowedUp }: NowSurfaceProps) {
  const [actions, setActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('next_actions').select('*').limit(10);
    if (!error) setActions((data ?? []) as NextAction[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const handleApprove = async (id: string) => {
    setBusy(id);
    try {
      await onApprove(id);
      await reload();
    } finally {
      setBusy(null);
    }
  };
  const handleReject = async (id: string) => {
    setBusy(id);
    try {
      await onReject(id);
      await reload();
    } finally {
      setBusy(null);
    }
  };
  const handleMark = async (id: string) => {
    if (!onMarkFollowedUp) return;
    setBusy(id);
    try {
      await onMarkFollowedUp(id);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  if (loading && actions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-secondary text-sm">Loading the focus list…</p>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <Zap size={32} className="mx-auto text-accent/50 mb-3" />
        <p className="text-primary text-sm font-medium">Inbox zero.</p>
        <p className="text-secondary text-xs mt-1">No actions waiting and no overdue follow-ups.</p>
      </div>
    );
  }

  const [hero, ...rest] = actions;
  const followUps = rest.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero — the ONE thing */}
      <HeroCard
        action={hero}
        busy={busy === hero.id}
        onApprove={() => handleApprove(hero.id)}
        onReject={() => handleReject(hero.id)}
        onMark={() => handleMark(hero.id)}
      />

      {/* Below-the-fold: 5 follow-ups, dense list */}
      {followUps.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2 px-1">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-tertiary font-mono">
              Then these
            </h3>
            <span className="text-[10px] text-tertiary font-mono">{followUps.length} more</span>
          </div>
          <div className="bg-surface border border-border rounded-lg divide-y divide-border/40 overflow-hidden">
            {followUps.map((a) => (
              <FollowUpRow
                key={a.id}
                action={a}
                busy={busy === a.id}
                onApprove={() => handleApprove(a.id)}
                onReject={() => handleReject(a.id)}
                onMark={() => handleMark(a.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface CardProps {
  action: NextAction;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onMark: () => void;
}

function HeroCard({ action, busy, onApprove, onReject, onMark }: CardProps) {
  const isBreach = action.reason === 'sla_breach';
  return (
    <div className="hero-card rounded-xl p-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {isBreach ? (
            <AlertTriangle size={16} className="text-danger" />
          ) : (
            <Zap size={16} className="text-accent" />
          )}
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-secondary">
            {isBreach ? 'Overdue follow-up' : 'Next action'}
          </span>
          {action.priority !== null && (
            <span className="text-[10px] font-mono text-tertiary">P{action.priority}</span>
          )}
        </div>
        <SLABadge followUpAt={action.follow_up_at} />
      </div>

      <h2 className="text-2xl font-semibold text-primary leading-tight mb-2">{action.title}</h2>
      {action.subtitle && (
        <p className="text-sm text-secondary mb-4 line-clamp-3">{action.subtitle}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-tertiary font-mono mb-5">
        <span>{action.source}</span>
        {action.contact_name && <span>· {action.contact_name}</span>}
        <span>· {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}</span>
      </div>

      {action.draft_reply && (
        <details className="mb-4">
          <summary className="text-xs font-medium text-accent cursor-pointer hover:text-accent-bright">
            Draft reply
          </summary>
          <pre className="mt-2 p-3 bg-elevated/60 border border-border rounded text-xs text-secondary whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
            {action.draft_reply}
          </pre>
        </details>
      )}

      <div className="flex items-center gap-2">
        {isBreach ? (
          <button
            onClick={onMark}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-base font-semibold text-sm rounded-md hover:bg-accent-bright transition-colors disabled:opacity-50"
          >
            <Check size={14} />
            Mark followed up
          </button>
        ) : (
          <button
            onClick={onApprove}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-base font-semibold text-sm rounded-md hover:bg-accent-bright transition-colors disabled:opacity-50"
          >
            <Check size={14} />
            Approve
          </button>
        )}
        <button
          onClick={onReject}
          disabled={busy}
          className="flex items-center gap-2 px-3 py-2 text-sm text-secondary hover:text-danger hover:bg-danger/10 border border-border rounded-md transition-colors disabled:opacity-50"
        >
          <X size={14} />
          Skip
        </button>
        {action.contact_url && (
          <a
            href={action.contact_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-secondary hover:text-primary border border-border rounded-md ml-auto"
          >
            Open <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function FollowUpRow({ action, busy, onApprove, onReject, onMark }: CardProps) {
  const isBreach = action.reason === 'sla_breach';
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-elevated/30 transition-colors">
      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isBreach ? 'var(--color-danger)' : 'var(--color-accent)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-primary font-medium truncate">{action.title}</div>
        <div className="flex items-center gap-2 text-[11px] text-tertiary font-mono">
          <span>{action.source}</span>
          {action.priority !== null && <span>· P{action.priority}</span>}
          <SLABadge followUpAt={action.follow_up_at} compact />
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isBreach ? (
          <button
            onClick={onMark}
            disabled={busy}
            title="Mark followed up"
            className="p-1.5 text-success hover:bg-success/10 rounded disabled:opacity-50"
          >
            <Check size={14} />
          </button>
        ) : (
          <button
            onClick={onApprove}
            disabled={busy}
            title="Approve"
            className="p-1.5 text-accent hover:bg-accent/10 rounded disabled:opacity-50"
          >
            <Check size={14} />
          </button>
        )}
        <button
          onClick={onReject}
          disabled={busy}
          title="Skip"
          className="p-1.5 text-tertiary hover:text-danger hover:bg-danger/10 rounded disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
