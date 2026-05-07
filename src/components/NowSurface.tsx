'use client';

import { useEffect, useState } from 'react';
import { Zap, ExternalLink, Check, X, AlertTriangle, Target, Briefcase, MapPin, DollarSign, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { NextAction } from '@/types/triage';
import CardMeta from './CardMeta';
import ClickSpark from './ClickSpark';
import SLABadge from './SLABadge';
import WeeklyWinsBar from './WeeklyWinsBar';
import OutboundCounter from './OutboundCounter';
import MorningBriefing from './MorningBriefing';
import NudgesPanel from './NudgesPanel';
import AgentRunSheet from './AgentRunSheet';
import YourQueue from './YourQueue';
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
        toast.push('success', `Promoted: ${company}`, {
          label: 'View',
          run: () => {
            // Switch to pipeline tab — best-effort; full nav handled by parent
            window.dispatchEvent(new CustomEvent('control-tower:goto', { detail: 'pipeline' }));
          },
        });
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

  // Summary line — when there ARE actions, give a one-line read of the focus list
  const breachCount = actions.filter((a) => a.reason === 'sla_breach').length;
  const dueCount = actions.filter((a) => a.reason === 'engagement_due').length;
  const pendingCount = actions.filter((a) => a.reason === 'pending_review').length;

  return (
    <div className="space-y-5">
      {/* Summary header — only shows when there's something to do */}
      {hasActions && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
            <span className="text-tertiary">Focus</span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                {pendingCount} pending
              </span>
            )}
            {breachCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/10 text-danger">
                {breachCount} overdue
              </span>
            )}
            {dueCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-money/10 text-money">
                {dueCount} due
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chief of staff morning briefing — one-paragraph context (Claude) */}
      <MorningBriefing />

      {/* AGENT lane — what the cron did/will do */}
      <AgentRunSheet />

      {/* Heuristic nudges — works without Claude, computes from existing data */}
      <NudgesPanel />

      {/* YOUR lane — items the agent prepared, only you can finish */}
      <YourQueue />

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
        <div className="bg-surface border border-border rounded-lg p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-accent" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-secondary">
              Inbox zero — what now?
            </span>
          </div>
          <h2 className="text-xl font-semibold text-primary mb-3">Today&apos;s mission, then</h2>
          <ul className="space-y-2 text-sm text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">→</span>
              <span>Log 5 outbound prospect touches (use the counter on the right).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-money mt-0.5">→</span>
              <span>Open the Pipeline tab and advance one customer engagement by one stage.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-info mt-0.5">→</span>
              <span>Update April&apos;s revenue + expenses in the runway widget so your runway reads true.</span>
            </li>
          </ul>
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
    <div className="hero-card rounded-xl p-5 sm:p-6 animate-fade-up">
      {/* Top meta row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${
            isBreach ? 'bg-danger/10' : action.reason === 'engagement_due' ? 'bg-money/10' : 'bg-accent/10'
          }`}>
            <Icon size={14} className={meta.color} />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-secondary block leading-none">
              {meta.label}
            </span>
            {action.priority !== null && (
              <span className="text-[9px] font-mono text-tertiary">Priority {action.priority}</span>
            )}
          </div>
        </div>
        <SLABadge followUpAt={action.follow_up_at} />
      </div>

      {/* Title — large and prominent */}
      <h2 className="text-xl sm:text-2xl font-bold text-primary leading-tight mb-2 tracking-[-0.01em]">
        {action.title}
      </h2>
      {action.subtitle && (
        <p className="text-sm text-secondary/80 mb-3 line-clamp-3 leading-relaxed">{action.subtitle}</p>
      )}

      {/* Per feedback_job_card_required_fields.md — JOB cards must surface location/mode/salary/easy_apply/JD link/cover letter */}
      <JobMeta action={action} />

      {/* Provenance + action + who — uniform meta strip */}
      <div className="mb-4">
        <CardMeta
          source={action.source}
          category={action.category}
          actionType={action.action_type}
          contactName={action.contact_name}
          contactUrl={action.contact_url}
        />
      </div>

      {/* Contact + time */}
      <div className="flex items-center gap-2 text-[11px] text-tertiary font-mono mb-5 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-elevated/60 border border-border/50">
          {action.source}
        </span>
        {action.contact_name && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-elevated/60 border border-border/50">
            {action.contact_name}
          </span>
        )}
        <span className="text-tertiary/50">
          {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Draft reply */}
      {action.draft_reply && (
        <details className="mb-5 group/draft">
          <summary className="text-xs font-medium text-accent cursor-pointer hover:text-accent-bright inline-flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-accent/10 inline-flex items-center justify-center text-[10px] group-open/draft:rotate-90 transition-transform">›</span>
            Draft reply
          </summary>
          <pre className="mt-2 p-3 bg-elevated/40 border border-border/40 rounded-lg text-xs text-secondary/90 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
            {action.draft_reply}
          </pre>
        </details>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {isBreach ? (
          <button
            onClick={onMark}
            disabled={busy}
            className="glow-btn flex items-center gap-2 px-5 py-2.5 bg-accent text-base font-semibold text-sm rounded-lg hover:bg-accent-bright transition-all disabled:opacity-50"
          >
            <Check size={14} />
            Mark followed up
          </button>
        ) : (
          <button
            onClick={onApprove}
            disabled={busy}
            className="glow-btn flex items-center gap-2 px-5 py-2.5 bg-accent text-base font-semibold text-sm rounded-lg hover:bg-accent-bright transition-all disabled:opacity-50"
          >
            <Check size={14} />
            Approve
          </button>
        )}
        <button
          onClick={onReject}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-secondary hover:text-danger hover:bg-danger/8 border border-border rounded-lg transition-all disabled:opacity-50"
        >
          <X size={14} />
          Skip
        </button>
        {promotable && onPromote && (
          <button
            onClick={onPromote}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-money border border-money/25 hover:bg-money/8 rounded-lg transition-all disabled:opacity-50"
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
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-secondary/70 hover:text-primary border border-border/50 rounded-lg ml-auto transition-all"
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
  const borderColor = action.reason === 'sla_breach'
    ? 'border-l-danger'
    : action.reason === 'engagement_due'
      ? 'border-l-money'
      : 'border-l-accent';
  return (
    <div className={`px-4 py-3 flex items-center gap-3 hover:bg-elevated/40 transition-all border-l-2 ${borderColor} border-l-opacity-60`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-primary font-medium truncate" title={action.title}>{action.title}</div>
        {action.subtitle && (
          <div className="text-[11px] text-secondary/80 line-clamp-1 mt-0.5" title={action.subtitle}>
            {action.subtitle}
          </div>
        )}
        {action.category === 'job' && (
          <div className="flex items-center gap-1.5 text-[10px] text-secondary mt-0.5 flex-wrap">
            {action.location && (
              <span className="inline-flex items-center gap-0.5"><MapPin size={9} className="text-tertiary" /> {action.location}</span>
            )}
            {action.salary_range && (
              <span className="inline-flex items-center gap-0.5 text-money font-mono"><DollarSign size={9} /> {action.salary_range}</span>
            )}
            {action.easy_apply && (
              <span className="inline-flex items-center gap-0.5 text-success font-mono uppercase tracking-wider"><Zap size={9} /> easy apply</span>
            )}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <CardMeta
            source={action.source}
            category={action.category}
            actionType={action.action_type}
            contactName={action.contact_name}
            contactUrl={action.contact_url}
            compact
          />
          <span className="text-[10px] font-mono text-tertiary">
            <span className={`${meta.color} font-medium`}>{meta.label.split(' ')[0]}</span>
            {action.priority !== null && <> · P{action.priority}</>}
          </span>
          <SLABadge followUpAt={action.follow_up_at} compact />
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {isBreach ? (
          <button
            onClick={onMark}
            disabled={busy}
            title="Mark followed up"
            className="p-2 text-success hover:bg-success/10 rounded-lg disabled:opacity-50 transition-all"
          >
            <Check size={14} />
          </button>
        ) : (
          <button
            onClick={onApprove}
            disabled={busy}
            title="Approve"
            className="p-2 text-accent hover:bg-accent/10 rounded-lg disabled:opacity-50 transition-all"
          >
            <Check size={14} />
          </button>
        )}
        <button
          onClick={onReject}
          disabled={busy}
          title="Skip"
          className="p-2 text-tertiary hover:text-danger hover:bg-danger/8 rounded-lg disabled:opacity-50 transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}


interface JobMetaProps { action: NextAction }
/**
 * Per Philippe's brief: every JOB next-action MUST surface location, work mode,
 * salary, easy_apply pill, posted-via source, JD link, and cover letter preview.
 * Codified in feedback_job_card_required_fields.md.
 */
function JobMeta({ action }: JobMetaProps) {
  if (action.category !== 'job') return null;
  const flag = (loc: string | null | undefined): string => {
    if (!loc) return '';
    const t = loc.toLowerCase();
    if (t.includes('switzer') || t.includes('zurich') || t.includes('zürich') || t.includes('basel') || t.includes('geneva') || t.includes('lausanne') || t.includes('bern')) return '🇨🇭';
    if (t.includes('portug') || t.includes('lisbon') || t.includes('porto')) return '🇵🇹';
    if (t.includes('germ') || t.includes('berlin') || t.includes('munich')) return '🇩🇪';
    if (t.includes('united states') || t.includes('usa') || t.includes(', us') || t.includes(', new york') || t.includes(', ca')) return '🇺🇸';
    if (t.includes('united kingdom') || t.includes(' uk') || t.includes('london') || t.includes('england')) return '🇬🇧';
    if (t.includes('france') || t.includes('paris')) return '🇫🇷';
    if (t.includes('netherlands') || t.includes('amsterdam')) return '🇳🇱';
    if (t.includes('canada') || t.includes('toronto')) return '🇨🇦';
    if (t.includes('remote')) return '🌍';
    if (t.includes('europe') || t.includes('eu')) return '🇪🇺';
    return '';
  };
  const loc = action.location ?? '';
  const remote = loc.toLowerCase().includes('remote');
  const hybrid = loc.toLowerCase().includes('hybrid');
  const workMode = remote ? 'Remote' : hybrid ? 'Hybrid' : (loc ? 'On-site' : null);
  const workTone = remote ? 'bg-success/15 text-success border-success/30' : hybrid ? 'bg-info/15 text-info border-info/30' : 'bg-warning/15 text-warning border-warning/30';
  const jdUrl = action.source_url || action.contact_url || null;
  return (
    <div className="space-y-2 my-3">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {workMode && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${workTone} font-mono uppercase tracking-wider text-[10px]`}>
            <Briefcase size={11} /> {workMode}
          </span>
        )}
        {action.location && (
          <span className="inline-flex items-center gap-1 text-secondary">
            {flag(action.location) && <span aria-hidden className="text-base leading-none">{flag(action.location)}</span>}
            <MapPin size={11} className="text-tertiary" />
            <span>{action.location}</span>
          </span>
        )}
        {action.salary_range && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-money/10 text-money border border-money/30 text-[11px] font-mono">
            <DollarSign size={11} /> {action.salary_range}
          </span>
        )}
        {action.job_type && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-elevated/60 text-tertiary text-[10px] font-mono uppercase tracking-wider">
            {action.job_type}
          </span>
        )}
        {action.easy_apply && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/15 text-success border border-success/30 text-[10px] font-mono uppercase tracking-wider">
            <Zap size={10} /> Easy Apply
          </span>
        )}
        {action.recruiter_name && (
          <span className="inline-flex items-center gap-1 text-[11px] text-info">
            <span className="text-tertiary">recruiter</span> {action.recruiter_name}
          </span>
        )}
      </div>

      {/* Score breakdown chips when present */}
      {action.score_breakdown && Object.keys(action.score_breakdown).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(action.score_breakdown).slice(0, 8).map(([factor, points]) => (
            <span key={factor} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono">
              {factor}: +{points}
            </span>
          ))}
        </div>
      )}

      {/* Cover letter preview */}
      {action.cover_letter && (
        <details className="group">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-secondary/60 font-mono mb-1 flex items-center gap-1 hover:text-accent transition-colors">
            <FileText size={10} /> Cover letter (Claude — click to expand)
          </summary>
          <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap bg-accent/5 border border-accent/15 rounded-md px-3 py-2 mt-1">
            {action.cover_letter}
          </p>
        </details>
      )}

      {/* JD link (the actual job posting, separate from "Open" button) */}
      {jdUrl && (
        <a href={jdUrl} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-info bg-info/10 hover:bg-info/20 rounded-md transition-colors">
          <Briefcase size={11} /> Read the JD <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}
