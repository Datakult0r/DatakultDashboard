'use client';

/**
 * AgentRunSheet — top-of-NOW timeline answering "what is the agent doing today?"
 * Pulls from system_health (cron audit log) + philippe_jobs (auto-apply outcomes)
 * + customer_engagements (auto-promotions). Read-only — pure transparency.
 */

import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, AlertTriangle, Clock, Zap, ExternalLink, Sparkles } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import ShinyText from './ShinyText';

interface HealthRow {
  source: string;
  operation: string;
  status: string;
  items_count: number;
  fallback_used: string | null;
  created_at: string;
}
interface AppliedJob {
  id: string;
  company: string;
  title: string;
  apply_status: string;
  browser_use_session_id: string | null;
  apply_reason: string | null;
  updated_at: string;
}

const TONE: Record<string, string> = {
  ok:       'text-success border-success/20 bg-success/5',
  fallback: 'text-info border-info/20 bg-info/5',
  skipped:  'text-tertiary border-border/40 bg-elevated/30',
  error:    'text-danger border-danger/20 bg-danger/5',
};

export default function AgentRunSheet() {
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [applied, setApplied] = useState<AppliedJob[]>([]);
  const [queueCount, setQueueCount] = useState(0);

  const reload = async () => {
    const since = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
    const { data: h } = await supabase
      .from('system_health')
      .select('source, operation, status, items_count, fallback_used, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10);
    setHealth((h ?? []) as HealthRow[]);

    const today = new Date(); today.setHours(0,0,0,0);
    const { data: a } = await supabase
      .from('philippe_jobs')
      .select('id, company, title, apply_status, browser_use_session_id, apply_reason, updated_at')
      .in('apply_status', ['APPLIED', 'APPLYING', 'FAILED'])
      .gte('updated_at', today.toISOString())
      .order('updated_at', { ascending: false });
    setApplied((a ?? []) as AppliedJob[]);

    const since7d = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const { count } = await supabase
      .from('philippe_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('decision', 'STRONG_APPLY').eq('apply_type', 'easy_apply').eq('apply_status', 'SCORED')
      .not('cover_note', 'is', null).gte('created_at', since7d);
    setQueueCount(Math.min(count ?? 0, 3));
  };

  useEffect(() => {
    reload();
    const ch = supabase.channel('agent_run_sheet')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_health' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'philippe_jobs' }, reload)
      .subscribe();
    const id = setInterval(reload, 60_000);
    return () => { ch.unsubscribe(); clearInterval(id); };
  }, []);

  const lastTriage = health.find((h) => h.operation.includes('score_jobs') || h.source === 'apify');
  const successCount = applied.filter((a) => a.apply_status === 'APPLIED').length;
  const failedCount = applied.filter((a) => a.apply_status === 'FAILED').length;
  const applyingCount = applied.filter((a) => a.apply_status === 'APPLYING').length;

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Bot size={14} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-none"><ShinyText className="text-accent">Agent run-sheet</ShinyText></h3>
            <p className="text-[10px] text-tertiary mt-0.5">Cron-driven actions · last 18h</p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-tertiary flex items-center gap-3">
          {successCount > 0 && <span className="text-success">✓{successCount} applied</span>}
          {applyingCount > 0 && <span className="text-warning">⟳{applyingCount} in-flight</span>}
          {failedCount > 0 && <span className="text-danger">✗{failedCount} failed</span>}
          {queueCount > 0 && <span className="text-info">⏳{queueCount} queued</span>}
        </div>
      </div>

      {/* Schedule strip */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-tertiary mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/40 bg-elevated/30">
          <Clock size={10} /> 08:00 Lisbon · Triage cron
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/40 bg-elevated/30">
          <Zap size={10} /> 10:00 Lisbon · Auto-apply cron (cap 3/day)
        </span>
      </div>

      {/* Today's applied jobs */}
      {applied.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-tertiary mb-2">Today's submissions</div>
          <ul className="space-y-1.5">
            {applied.slice(0, 5).map((a) => {
              const tone = a.apply_status === 'APPLIED' ? 'success' : a.apply_status === 'APPLYING' ? 'warning' : 'danger';
              const Icon = a.apply_status === 'APPLIED' ? CheckCircle2 : a.apply_status === 'APPLYING' ? Clock : AlertTriangle;
              return (
                <li key={a.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border bg-${tone}/5 border-${tone}/15 text-xs`}>
                  <Icon size={12} className={`text-${tone}`} />
                  <span className={`text-[10px] font-mono uppercase tracking-wider text-${tone}`}>{a.apply_status}</span>
                  <span className="opacity-30">·</span>
                  <span className="font-medium text-primary truncate flex-1" title={`${a.company} — ${a.title}`}>
                    {a.company} <span className="text-secondary">— {a.title}</span>
                  </span>
                  {a.browser_use_session_id && (
                    <a href={`https://cloud.browser-use.com/dashboard/session/${a.browser_use_session_id}`}
                      target="_blank" rel="noopener noreferrer"
                      title="Inspect Browser Use session"
                      className="text-[10px] font-mono text-info hover:underline inline-flex items-center gap-0.5">
                      session <ExternalLink size={9} />
                    </a>
                  )}
                  <span className="text-[10px] font-mono text-tertiary/60 shrink-0">
                    {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Recent cron operations (compact) */}
      {health.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-tertiary mb-2 flex items-center justify-between">
            <span>Cron operations</span>
            {lastTriage && (
              <span className="text-tertiary/60 font-normal normal-case tracking-normal">
                last run: {format(new Date(lastTriage.created_at), 'HH:mm')}
              </span>
            )}
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {health.slice(0, 8).map((h, i) => (
              <li key={i} className={`text-[11px] font-mono px-2 py-1 rounded-md border ${TONE[h.status] ?? TONE.skipped} flex items-center gap-2`}>
                <span className="opacity-60">{format(new Date(h.created_at), 'HH:mm')}</span>
                <span className="truncate flex-1">{h.source} · {h.operation}</span>
                {h.items_count > 0 && <span className="opacity-70">{h.items_count}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {applied.length === 0 && health.length === 0 && (
        <div className="text-xs text-tertiary px-3 py-3 border border-dashed border-border/40 rounded-md text-center">
          <Sparkles size={14} className="mx-auto mb-1 opacity-40" />
          <p>No agent activity yet today. First triage cron at 08:00 Lisbon.</p>
        </div>
      )}
    </div>
  );
}
