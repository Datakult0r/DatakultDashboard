'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase, Search, ExternalLink, ChevronDown, ChevronUp,
  Sparkles, FileText, MapPin, Building2, Zap, Globe2, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PhilippeJob, PhilippeJobSource } from '@/types/triage';

const DECISION_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  STRONG_APPLY: { bg: 'bg-success/15', text: 'text-success', ring: 'ring-success/30' },
  APPLY:        { bg: 'bg-accent/15',  text: 'text-accent',  ring: 'ring-accent/30' },
  LIGHT:        { bg: 'bg-info/15',    text: 'text-info',    ring: 'ring-info/30' },
  SKIP:         { bg: 'bg-secondary/10', text: 'text-tertiary', ring: 'ring-secondary/20' },
};

const SOURCE_LABEL: Record<PhilippeJobSource, string> = {
  linkedin: 'LinkedIn',
  remoteok: 'RemoteOK',
  wttj: 'Welcome to the Jungle',
  indeed: 'Indeed',
  jobup: 'JobUp',
  glassdoor: 'Glassdoor',
};

type Filter = 'all' | 'strong' | 'apply_or_better' | 'has_cover';

/**
 * JobsTracker — single dense view of all scored jobs from `philippe_jobs`.
 * Each row expands inline to reveal the Claude-generated cover letter + CV focus.
 * No flip-cards — accessible, readable, fast.
 */
export default function JobsTracker() {
  const [jobs, setJobs] = useState<PhilippeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('philippe_jobs')
      .select('*')
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    setJobs((data ?? []) as PhilippeJob[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const ch = supabase
      .channel('philippe_jobs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'philippe_jobs' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const stats = useMemo(() => {
    const strong = jobs.filter((j) => j.decision === 'STRONG_APPLY').length;
    const apply = jobs.filter((j) => j.decision === 'APPLY').length;
    const light = jobs.filter((j) => j.decision === 'LIGHT').length;
    const withCover = jobs.filter((j) => j.cover_note && j.cover_note.length > 50).length;
    const sources = Array.from(new Set(jobs.map((j) => j.source))) as PhilippeJobSource[];
    return { total: jobs.length, strong, apply, light, withCover, sources };
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter === 'strong' && j.decision !== 'STRONG_APPLY') return false;
      if (filter === 'apply_or_better' && j.decision !== 'STRONG_APPLY' && j.decision !== 'APPLY') return false;
      if (filter === 'has_cover' && (!j.cover_note || j.cover_note.length < 50)) return false;
      if (!q) return true;
      const blob = `${j.title} ${j.company} ${j.location ?? ''} ${j.cover_note ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [jobs, search, filter]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <Tile label="Total" value={stats.total} tint="accent" />
        <Tile label="Strong" value={stats.strong} tint="success" />
        <Tile label="Apply" value={stats.apply} tint="info" />
        <Tile label="Cover ready" value={stats.withCover} tint="money" />
        <Tile label="Sources" value={stats.sources.length} tint="warning" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter jobs by title, company, location, cover letter..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-elevated/40 border border-border/60 rounded-lg focus:border-accent/40 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-elevated/40 border border-border/60 rounded-lg p-0.5">
          {(['all', 'strong', 'apply_or_better', 'has_cover'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${
                filter === f ? 'bg-accent/15 text-accent' : 'text-tertiary hover:text-secondary'
              }`}
            >
              {f === 'all' ? 'All' : f === 'strong' ? 'Strong' : f === 'apply_or_better' ? '≥ Apply' : 'Has cover'}
            </button>
          ))}
          <button onClick={reload} className="ml-1 p-1.5 rounded-md text-tertiary hover:text-accent transition-colors" title="Reload">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-tertiary text-sm">
            No jobs match. Cron runs daily at 07:00 Lisbon — fresh jobs each morning.
          </div>
        )}
        {filtered.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            isExpanded={expandedId === job.id}
            onToggle={() => setExpandedId(expandedId === job.id ? null : job.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, tint }: { label: string; value: number; tint: string }) {
  const tintMap: Record<string, string> = {
    accent: 'bg-accent/5 text-accent border-accent/15',
    success: 'bg-success/5 text-success border-success/15',
    info: 'bg-info/5 text-info border-info/15',
    money: 'bg-money/5 text-money border-money/15',
    warning: 'bg-warning/5 text-warning border-warning/15',
  };
  return (
    <div className={`rounded-lg border ${tintMap[tint] ?? tintMap.accent} px-3 py-2`}>
      <div className="text-[9px] uppercase tracking-wider text-tertiary font-mono">{label}</div>
      <div className="text-lg font-mono font-bold mt-0.5">{value}</div>
    </div>
  );
}

interface JobRowProps {
  job: PhilippeJob;
  isExpanded: boolean;
  onToggle: () => void;
}

function JobRow({ job, isExpanded, onToggle }: JobRowProps) {
  const dec = job.decision ?? 'LIGHT';
  const style = DECISION_STYLE[dec] ?? DECISION_STYLE.LIGHT;
  const hasCover = Boolean(job.cover_note && job.cover_note.length > 50);
  const sourceLabel = SOURCE_LABEL[job.source] ?? job.source;

  return (
    <div className={`rounded-lg border transition-all ${isExpanded ? 'border-accent/40 bg-elevated/20' : 'border-border/60 bg-surface hover:border-secondary/60'} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        <div className={`shrink-0 w-12 h-12 rounded-lg ${style.bg} ${style.text} flex flex-col items-center justify-center font-mono font-bold ring-1 ${style.ring}`}>
          <span className="text-base leading-none">{job.score ?? '–'}</span>
          <span className="text-[8px] tracking-widest mt-0.5 opacity-70">{dec.replace('_', ' ').slice(0, 6)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-tertiary">
            <Building2 size={10} />
            <span className="truncate">{job.company}</span>
            <span className="opacity-30">·</span>
            <Globe2 size={10} />
            <span>{sourceLabel}</span>
            {hasCover && (<><span className="opacity-30">·</span><FileText size={10} className="text-accent" /><span className="text-accent">cover</span></>)}
          </div>
          <p className="text-sm font-medium text-primary truncate mt-0.5">{job.title}</p>
          {job.location && (
            <div className="flex items-center gap-1 text-[11px] text-secondary mt-0.5">
              <MapPin size={11} />
              <span className="truncate">{job.location}</span>
              {job.work_mode && <span className="ml-1 px-1.5 py-px rounded bg-elevated text-[9px] uppercase tracking-wider">{job.work_mode}</span>}
              {job.apply_type === 'easy_apply' && <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-px rounded bg-success/15 text-success text-[9px]"><Zap size={8}/> easy</span>}
            </div>
          )}
        </div>

        <span className="text-tertiary/60 shrink-0">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/40 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <div className="space-y-2">
              {job.cover_note && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1 flex items-center gap-1">
                    <FileText size={10} /> Cover letter (Claude-generated)
                  </p>
                  <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap bg-accent/5 border border-accent/15 rounded-md px-3 py-2">{job.cover_note}</p>
                </div>
              )}
              {job.application_requirements && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Requirements</p>
                  <p className="text-xs text-secondary leading-relaxed line-clamp-6">{job.application_requirements}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {job.description_text && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Job description</p>
                  <p className="text-xs text-secondary leading-relaxed line-clamp-12 whitespace-pre-wrap">{job.description_text}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {job.job_url && (
                  <a href={job.job_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors">
                    <Briefcase size={11} /> Open job <ExternalLink size={10} />
                  </a>
                )}
                {job.cover_note && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(job.cover_note ?? ''); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-info bg-info/10 hover:bg-info/20 rounded-md transition-colors"
                  >
                    <Sparkles size={11} /> Copy cover letter
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
