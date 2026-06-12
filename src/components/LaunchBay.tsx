'use client';

import { useState } from 'react';
import { Rocket, Eye, Send, CheckCircle2, AlertTriangle, Loader2, ExternalLink, Hand } from 'lucide-react';
import type { TriageItem } from '@/types/triage';
import ScoreChip from './ScoreChip';

interface LaunchBayProps {
  /** All actionable job items (apply_job_easy / apply_job_website) */
  items: TriageItem[];
  /** Trigger immediate Easy Apply launch for an approved item */
  onRunNow: (id: string) => Promise<void>;
  /** Trigger final submit for a filled website application */
  onSend: (id: string) => Promise<void>;
  /** Confirm a manual submission */
  onMarkSubmitted: (id: string) => Promise<void>;
}

/**
 * LaunchBay — everything that happens AFTER approve, finally visible.
 * Executing sessions (with live view), filled applications waiting for the
 * one human click, the agent's launch queue, and what needs Philippe's hands.
 */
export default function LaunchBay({ items, onRunNow, onSend, onMarkSubmitted }: LaunchBayProps) {
  const [busy, setBusy] = useState<Record<string, string>>({});

  const jobItems = items.filter((i) => i.action_type === 'apply_job_easy' || i.action_type === 'apply_job_website');

  const executing = jobItems.filter((i) => i.action_status === 'executing');
  const readyToSend = jobItems.filter(
    (i) => i.action_status === 'approved' && ['true', 'expired'].includes((i.action_payload?.ready_to_send as string) || '')
  );
  const queued = jobItems.filter(
    (i) => i.action_status === 'approved' && !['true', 'expired'].includes((i.action_payload?.ready_to_send as string) || '')
  );
  const needsYou = jobItems.filter(
    (i) => i.action_status === 'failed' && (i.notes?.includes('needs_human') || i.notes?.includes('Needs you') || i.notes?.includes('logged_out') || i.notes?.includes('manually'))
  );
  const doneToday = jobItems.filter((i) => i.action_status === 'executed');

  const act = async (id: string, kind: string, fn: (id: string) => Promise<void>) => {
    setBusy((b) => ({ ...b, [id]: kind }));
    try { await fn(id); } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  const liveUrl = (i: TriageItem) => (i.action_payload?.browser_use_live_url as string) || '';

  const Row = ({ item, children }: { item: TriageItem; children?: React.ReactNode }) => (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2.5 hover:border-secondary/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate">
          {item.role_title || item.title}
          {item.company && <span className="text-secondary font-normal"> · {item.company}</span>}
        </p>
        {item.notes && <p className="text-[11px] text-secondary/80 truncate mt-0.5">{item.notes}</p>}
      </div>
      {item.score !== null && item.score_label && <ScoreChip score={item.score} label={item.score_label} />}
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${item.action_type === 'apply_job_easy' ? 'bg-info/10 text-info' : 'bg-accent/10 text-accent'}`}>
        {item.action_type === 'apply_job_easy' ? 'LinkedIn' : 'Website'}
      </span>
      {children}
    </div>
  );

  const Section = ({ icon, title, hint, count, children }: { icon: React.ReactNode; title: string; hint: string; count: number; children: React.ReactNode }) => (
    count === 0 ? null : (
      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">{icon}{title}
            <span className="text-xs font-mono text-secondary">({count})</span>
          </h3>
          <span className="text-[11px] text-secondary/70">{hint}</span>
        </div>
        <div className="grid gap-2">{children}</div>
      </div>
    )
  );

  if (jobItems.length === 0) {
    return (
      <div className="text-center py-16">
        <Rocket size={32} className="mx-auto text-secondary/40 mb-3" />
        <p className="text-secondary text-sm">Nothing in the launch bay. Approve jobs and the agents take it from there.</p>
      </div>
    );
  }

  return (
    <div>
      <Section icon={<Loader2 size={15} className="animate-spin text-info" />} title="Executing now" hint="agents working — watch them live" count={executing.length}>
        {executing.map((item) => (
          <Row key={item.id} item={item}>
            {liveUrl(item) && (
              <a href={liveUrl(item)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-info/10 text-info hover:bg-info/20 border border-info/20">
                <Eye size={13} /> Watch
              </a>
            )}
          </Row>
        ))}
      </Section>

      <Section icon={<Send size={15} className="text-accent" />} title="Ready to send" hint="form filled by the agent — review, then one click sends it" count={readyToSend.length}>
        {readyToSend.map((item) => (
          <Row key={item.id} item={item}>
            {liveUrl(item) && (
              <a href={liveUrl(item)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-elevated text-secondary hover:text-primary border border-border">
                <Eye size={13} /> Review
              </a>
            )}
            <button
              onClick={() => act(item.id, 'send', onSend)}
              disabled={Boolean(busy[item.id])}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy[item.id] === 'send' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send
            </button>
          </Row>
        ))}
      </Section>

      <Section icon={<Rocket size={15} className="text-warning" />} title="Launch queue" hint="agents fire these in the next window — or run one now" count={queued.length}>
        {queued.map((item) => (
          <Row key={item.id} item={item}>
            {item.action_type === 'apply_job_easy' ? (
              <button
                onClick={() => act(item.id, 'run', onRunNow)}
                disabled={Boolean(busy[item.id])}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-warning/15 text-warning hover:bg-warning/25 border border-warning/25 disabled:opacity-50"
              >
                {busy[item.id] === 'run' ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
                Run now
              </button>
            ) : (
              <span className="text-[11px] text-secondary/70 font-mono">auto-fill queued</span>
            )}
          </Row>
        ))}
      </Section>

      <Section icon={<Hand size={15} className="text-danger" />} title="Needs you" hint="the agent refused to guess — finish these by hand" count={needsYou.length}>
        {needsYou.map((item) => (
          <Row key={item.id} item={item}>
            {(item.contact_url || item.source_url) && (
              <a href={item.contact_url || item.source_url || '#'} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-elevated text-secondary hover:text-primary border border-border">
                <ExternalLink size={13} /> Open
              </a>
            )}
            <button
              onClick={() => act(item.id, 'mark', onMarkSubmitted)}
              disabled={Boolean(busy[item.id])}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-success/10 text-success hover:bg-success/20 border border-success/25 disabled:opacity-50"
            >
              {busy[item.id] === 'mark' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              I submitted it
            </button>
          </Row>
        ))}
      </Section>

      <Section icon={<CheckCircle2 size={15} className="text-success" />} title="Launched" hint="confirmed submissions — tracked in Pipeline" count={doneToday.length}>
        {doneToday.slice(0, 10).map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </Section>

      {needsYou.length === 0 && executing.length === 0 && readyToSend.length === 0 && queued.length === 0 && doneToday.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-secondary mt-2"><AlertTriangle size={12} /> All clear — next agent window fires automatically.</p>
      )}
    </div>
  );
}
