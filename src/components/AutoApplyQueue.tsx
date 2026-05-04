'use client';
import { useEffect, useState } from 'react';
import { Zap, X, Pause, Play, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clearbitLogoUrl, locationFlag } from '@/lib/company-logo';
import type { PhilippeJob } from '@/types/triage';

const CAP = 3;

export default function AutoApplyQueue() {
  const [queue, setQueue] = useState<PhilippeJob[]>([]);
  const [paused, setPaused] = useState<{ paused: boolean; reason?: string } | null>(null);

  const reload = async () => {
    const since7d = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const { data } = await supabase.from('philippe_jobs').select('*')
      .eq('decision', 'STRONG_APPLY').eq('apply_type', 'easy_apply').eq('apply_status', 'SCORED')
      .not('cover_note', 'is', null).gte('created_at', since7d)
      .order('score', { ascending: false }).limit(CAP);
    setQueue((data ?? []) as PhilippeJob[]);
    const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data: failures } = await supabase.from('philippe_jobs')
      .select('id, company, apply_reason, updated_at')
      .eq('apply_status', 'FAILED').gte('updated_at', since24h).limit(1);
    if (failures && failures.length > 0) {
      const f = failures[0] as { company: string; apply_reason: string | null };
      setPaused({ paused: true, reason: `Last failure: ${f.company} — ${f.apply_reason ?? 'unknown'}` });
    } else { setPaused({ paused: false }); }
  };

  useEffect(() => {
    reload();
    const ch = supabase.channel('auto_apply_queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'philippe_jobs' }, reload).subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const skip = async (id: string) => {
    await supabase.from('philippe_jobs').update({ apply_status: 'SKIPPED' }).eq('id', id);
    setQueue((q) => q.filter((j) => j.id !== id));
  };

  const unpause = async () => {
    const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
    await supabase.from('philippe_jobs').update({ apply_status: 'SCORED' })
      .eq('apply_status', 'FAILED').gte('updated_at', since24h);
    await reload();
  };

  return (
    <div className="rounded-xl border border-success/20 bg-success/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-success flex items-center gap-2">
            <Zap size={14} /> Auto-apply queue · 10:00 Lisbon daily
          </h3>
          <p className="text-[11px] text-tertiary mt-0.5 leading-snug max-w-xl">
            Up to {CAP} STRONG_APPLY · easy_apply jobs submitted via Browser Use Cloud v3, random 90-180s pacing, halt-on-failure, 24h auto-pause.
          </p>
        </div>
        {paused?.paused ? (
          <button onClick={unpause} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-warning border border-warning/40 rounded-md px-2 py-1 hover:bg-warning/10">
            <Pause size={11} /> Paused — Resume
          </button>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-success">
            <Play size={11} /> Active
          </span>
        )}
      </div>
      {paused?.paused && paused.reason && (
        <div className="mb-3 px-3 py-2 rounded-md border border-warning/20 bg-warning/10 text-[11px] text-warning flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>Auto-paused for 24h. {paused.reason}.</span>
        </div>
      )}
      {queue.length === 0 && (
        <div className="text-xs text-tertiary px-3 py-4 border border-dashed border-border/40 rounded-md text-center">
          <Clock size={16} className="mx-auto mb-1 opacity-40" />
          <p>Nothing queued yet. The 08:00 scoring cron picks the next batch.</p>
        </div>
      )}
      <ul className="space-y-2">
        {queue.map((job, idx) => (
          <li key={job.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-success/15 bg-surface">
            <span className="shrink-0 text-[10px] font-mono font-bold text-success bg-success/10 rounded w-5 h-5 inline-flex items-center justify-center">{idx+1}</span>
            <Avatar company={job.company} url={clearbitLogoUrl(job.company)} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono text-tertiary uppercase tracking-wider truncate">{job.company} · score {job.score}</div>
              <div className="text-sm text-primary truncate" title={job.title}>{job.title}</div>
              <div className="text-[11px] text-secondary flex items-center gap-1">
                {locationFlag(job.location) && <span aria-hidden>{locationFlag(job.location)}</span>}
                <span className="truncate">{job.location ?? 'Location TBD'}</span>
              </div>
            </div>
            <button onClick={() => skip(job.id)} className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono text-tertiary hover:text-danger border border-border/40 rounded-md px-2 py-1 hover:border-danger/40">
              <X size={11} /> Skip
            </button>
          </li>
        ))}
      </ul>
      {queue.length > 0 && (
        <p className="text-[10px] text-tertiary/70 mt-3 italic flex items-center gap-1">
          <Sparkles size={10} /> Cover letters by Claude · Submissions via Browser Use Cloud v3
        </p>
      )}
    </div>
  );
}

function Avatar({ company, url }: { company: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) return (
    <img src={url} alt="" loading="lazy" onError={() => setFailed(true)}
      className="shrink-0 w-8 h-8 rounded-md object-contain bg-white/90 border border-border/40 p-0.5" />
  );
  return (
    <div className="shrink-0 w-8 h-8 rounded-md bg-elevated border border-border/40 flex items-center justify-center text-sm font-semibold text-secondary">
      {(company || '?').charAt(0).toUpperCase()}
    </div>
  );
}
