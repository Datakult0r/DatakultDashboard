'use client';

import { useEffect, useState } from 'react';
import { Zap, ExternalLink, Check, X, AlertTriangle, Target } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { NextAction } from '@/types/triage';
import SLABadge from './SLABadge';
import WeeklyWinsBar from './WeeklyWinsBar';
import OutboundCounter from './OutboundCounter';
import { useToast } from './Toast';

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
  const toast = useToast();

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('next_actions').select('*').limit(10);
    if (!error) setActions((data ?? []) as NextAction[]);
    setLoading(false);
  };

  // Promote a triage_item action into a customer_engagement
  const handlePromote = async (a: NextAction) => {
    setBusy(a.id);
    try {
      const company = a.contact_name || a.title.split(/[—–-]/)[0].trim();
      const r = await fetch('/api/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          contact_name: a.contact_name,
          contact_url: a.contact_url,
          source: a.source,
          stage: 'lead',
          notes: a.subtitle || a.title,
          triage_id: a.id,
        }),
      });
      if (r.ok) {
        toast.push('success', `Promoted to engagement: ${company}`);
      } else {
        toast.push('error', 'Failed to promote');
      }
    } finally {
      setBusy(null);
    }
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

  const hasActions = actions.length > 0;
  const [hero, ...rest] = actions;
  const followUps = rest.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Wins + outbound row — visible above the fold even when there are no actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <WeeklyWinsBar />
        </div>
        <OutboundCounter />
      </div>

      {/* Hero or empty state */}
      {loading && !hasActions ? (
        <div className="text-center py-16">
          <p className="text-secondary text-sm">Loading the focus list…</p>
        </div>
      ) : !hasActions ? (
        <div className="text-center py-16 animate-fade-in bg-surface border border-border rounded-lg">
          <Zap size={32} className="mx-auto text-accent/60 mb-3" />
          <p className="text-primary text-sm font-medium">Inbox zero.</p>
          <p className="text-secondary text-xs mt-1">No actions waiting and no overdue follow-ups.</p>
        </div>
      ) : (
        <>
          <HeroCard
            action={hero}
            busy={busy === hero.id}
            onApprove={() => handleApprove(hero.id)}
            onReject={() => handleReject(hero.id)}
            onMark={() => handleMark(hero.id)}
            onPromote={() => handlePromote(hero)}
          />
          {followUps.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-tertiary font-mono">Then these</h3>
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
        </>
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
  onPromote?: () => void;
}

function reasonMeta(reason: NextAction['reason']) {
  switch (reason) {
    case 'sla_breach':     return { icon: AlertTriangle, label: 'Overdue follow-up', color: 'text-danger' };
    case 'engagement_due': return { icon: Target,        label: 'Engagement next step due', color: 'text-money' };
    case 'pending_review':
    default:               return { icon: Zap,           label: 'Next action', color: 'text-accent' };
  }
}

function HeroCard({ action, busy, onApprove, onReject, onMark, onPromote }: CardProps) {
  const meta = reasonMeta(action.reason);
  const Icon = meta.icon;
  const isBreach = action.reason === 'sla_breach';
  const promotable =
    action.reason !== 'engagement_due' &&
    ['gmail','email','linkedin','linkedin_dm','beeper'].includes((action.source || '').toLowerCase());
  return (
    <div className="hero-card rounded-xl p-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Icon size={16} className={meta.color} />
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-secondary">
            {meta.label}
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
        {promotable && onPromote && (
          <button
            onClick={onPromote}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-money border border-money/30 hover:bg-money/10 rounded-md disabled:opacity-50"
            title="Create a customer engagement from this item"
          >
            <Target size={14} />
            Promote
          </button>
        )}
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
  const meta = reasonMeta(action.reason);
  const isBreach = action.reason === 'sla_breach';
  const dotColor = action.reason === 'sla_breach'
    ? 'var(--color-danger)'
    : action.reason === 'engagement_due'
      ? 'var(--color-money)'
      : 'var(--color-accent)';
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-elevated/30 transition-colors">
      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-primary font-medium truncate">{action.title}</div>
        <div className="flex items-center gap-2 text-[11px] text-tertiary font-mono">
          <span className={meta.color}>{meta.label.split(' ')[0]}</span>
          <span>·</span>
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
