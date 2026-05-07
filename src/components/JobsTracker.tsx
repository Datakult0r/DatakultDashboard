'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase, Search, ExternalLink, ChevronDown, ChevronUp,
  Sparkles, FileText, MapPin, Building2, Zap, Globe2, RefreshCw,
  AlertCircle, Calendar, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clearbitLogoUrl, locationFlag } from '@/lib/company-logo';
import CardMeta from './CardMeta';
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
  jobup: 'JobUp.ch',
  arbeit_swiss: 'Arbeit.Swiss',
  glassdoor: 'Glassdoor',
};

type Filter = 'all' | 'strong' | 'apply_or_better' | 'has_cover' | 'easy_apply';

/**
 * JobsTracker — single dense view of all scored jobs from `philippe_jobs`.
 * Rich row: company logo, country flag, score, Easy Apply, expandable cover letter.
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
    const easyApply = jobs.filter((j) => j.apply_type === 'easy_apply').length;
    const sources = Array.from(new Set(jobs.map((j) => j.source))) as PhilippeJobSource[];
    return { total: jobs.length, strong, apply, light, withCover, easyApply, sources };
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter === 'strong' && j.decision !== 'STRONG_APPLY') return false;
      if (filter === 'apply_or_better' && j.decision !== 'STRONG_APPLY' && j.decision !== 'APPLY') return false;
      if (filter === 'has_cover' && (!j.cover_note || j.cover_note.length < 50)) return false;
      if (filter === 'easy_apply' && j.apply_type !== 'easy_apply') return false;
      if (!q) return true;
      const blob = `${j.title} ${j.company} ${j.location ?? ''} ${j.cover_note ?? ''} ${j.description_text ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [jobs, search, filter]);

  return (
    <div className="space-y-4">
      {/* Section header explainer */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Briefcase size={14} className="text-info" /> Scored Jobs
          </h3>
          <p className="text-[11px] text-tertiary mt-0.5 leading-snug">
            Every job the cron discovered today, scored against your 0–100 rubric. Click any row to read the Claude-generated cover letter, JD, and apply.
          </p>
        </div>
        <button
          onClick={reload}
          title="Pull the latest scored jobs from Supabase"
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-tertiary hover:text-accent border border-border/40 rounded-md px-2 py-1"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Tile label="Total" value={stats.total} tint="accent" hint="All scored jobs (last 14 days)" />
        <Tile label="Strong" value={stats.strong} tint="success" hint="Score ≥ 65 — apply this week" />
        <Tile label="Apply" value={stats.apply} tint="info" hint="Score 50-64 — apply if time" />
        <Tile label="Cover ready" value={stats.withCover} tint="money" hint="Cover letter generated" />
        <Tile label="Easy apply" value={stats.easyApply} tint="warning" hint="One-click LinkedIn apply" />
        <Tile label="Sources" value={stats.sources.length} tint="info" hint="Distinct boards (LinkedIn / RemoteOK / …)" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title, company, location, cover letter, or JD text…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-elevated/40 border border-border/60 rounded-lg focus:border-accent/40 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-elevated/40 border border-border/60 rounded-lg p-0.5 flex-wrap">
          {([
            ['all', 'All', 'Show every scored job'],
            ['strong', 'Strong', 'Score ≥ 65 only'],
            ['apply_or_better', '≥ Apply', 'Score ≥ 50'],
            ['has_cover', 'Cover ready', 'Has a cover letter generated'],
            ['easy_apply', 'Easy apply', 'One-click LinkedIn apply'],
          ] as Array<[Filter, string, string]>).map(([f, label, hint]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              title={hint}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${
                filter === f ? 'bg-accent/15 text-accent' : 'text-tertiary hover:text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-tertiary text-sm border border-dashed border-border rounded-lg">
            <AlertCircle size={20} className="mx-auto mb-2 opacity-40" />
            <p>No jobs match your filter. The cron pulls fresh jobs each morning at 07:00 Lisbon.</p>
            <p className="text-[10px] mt-1 opacity-70">Sources: LinkedIn (Apify) + RemoteOK (free public API). 14-day retention.</p>
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

function Tile({ label, value, tint, hint }: { label: string; value: number; tint: string; hint?: string }) {
  const tintMap: Record<string, string> = {
    accent: 'bg-accent/5 text-accent border-accent/15',
    success: 'bg-success/5 text-success border-success/15',
    info: 'bg-info/5 text-info border-info/15',
    money: 'bg-money/5 text-money border-money/15',
    warning: 'bg-warning/5 text-warning border-warning/15',
  };
  return (
    <div title={hint} className={`rounded-lg border ${tintMap[tint] ?? tintMap.accent} px-3 py-2`}>
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
  const flag = locationFlag(job.location);
  const logo = clearbitLogoUrl(job.company);
  const isEasyApply = job.apply_type === 'easy_apply';

  return (
    <div className={`rounded-lg border transition-all ${isExpanded ? 'border-accent/40 bg-elevated/20' : 'border-border/60 bg-surface hover:border-secondary/60'} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        title="Click to read the cover letter, JD, and apply"
      >
        {/* Score chip with decision label */}
        <div className={`shrink-0 w-12 h-12 rounded-lg ${style.bg} ${style.text} flex flex-col items-center justify-center font-mono font-bold ring-1 ${style.ring}`}>
          <span className="text-base leading-none">{job.score ?? '–'}</span>
          <span className="text-[8px] tracking-widest mt-0.5 opacity-70">{dec.replace('_', ' ').slice(0, 6)}</span>
        </div>

        {/* Company logo (Clearbit, falls back to letter) */}
        <CompanyAvatar company={job.company} logoUrl={logo} />

        <div className="flex-1 min-w-0">
          <CardMeta
            source={job.source}
            category="job"
            actionType={isEasyApply ? 'apply_job_easy' : 'apply_job_website'}
            applyType={job.apply_type}
            company={job.company}
            location={job.location}
            postedText={job.posted_text}
            compact
          />
          {hasCover && (
            <span className="inline-flex items-center gap-1 text-[10px] text-accent mt-0.5" title="Claude generated a tailored cover letter">
              <FileText size={10} /> cover letter ready
            </span>
          )}
          <p className="text-sm font-medium text-primary truncate mt-0.5" title={job.title}>{job.title}</p>
          {job.location && (
            <div className="flex items-center gap-1 text-[11px] text-secondary mt-0.5 flex-wrap">
              {flag && <span className="text-base leading-none" aria-hidden>{flag}</span>}
              <MapPin size={11} />
              <span className="truncate" title={job.location}>{job.location}</span>
              {job.work_mode && <span className="ml-1 px-1.5 py-px rounded bg-elevated text-[9px] uppercase tracking-wider">{job.work_mode}</span>}
              {job.posted_text && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-tertiary" title="Posted on the source platform">
                  <Calendar size={9} /> {job.posted_text}
                </span>
              )}
            </div>
          )}
        </div>

        {/* LinkedIn-style Easy Apply pill — visible on every row */}
        <EasyApplyPill job={job} compact />

        <span className="text-tertiary/60 shrink-0 ml-1">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/40 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <div className="space-y-2">
              {job.cover_note && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1 flex items-center gap-1">
                    <FileText size={10} /> Cover letter — generated by Claude for THIS role
                  </p>
                  <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap bg-accent/5 border border-accent/15 rounded-md px-3 py-2">{job.cover_note}</p>
                </div>
              )}
              {job.application_requirements && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Hard requirements pulled from the JD</p>
                  <p className="text-xs text-secondary leading-relaxed line-clamp-6">{job.application_requirements}</p>
                </div>
              )}
              {job.apply_status && job.apply_status !== 'SCORED' && (
                <div className="text-[10px] font-mono">
                  Apply status: <span className="text-accent">{job.apply_status}</span>
                  {job.apply_reason && <span className="text-tertiary"> · {job.apply_reason}</span>}
                </div>
              )}
            </div>
            <div className="space-y-2">
              {job.description_text && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Job description</p>
                  <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap line-clamp-12">{job.description_text}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {job.job_url && (
                  <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open the job posting on the source site in a new tab"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
                  >
                    <Briefcase size={11} /> Open job <ExternalLink size={10} />
                  </a>
                )}
                {job.cover_note && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(job.cover_note ?? ''); }}
                    title="Copy the cover letter text to your clipboard"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-info bg-info/10 hover:bg-info/20 rounded-md transition-colors"
                  >
                    <Sparkles size={11} /> Copy cover letter
                  </button>
                )}
                <EasyApplyPill job={job} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyAvatar({ company, logoUrl }: { company: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = (company || '?').charAt(0).toUpperCase();
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 w-9 h-9 rounded-md object-contain bg-white/90 border border-border/40 p-0.5"
      />
    );
  }
  return (
    <div className="shrink-0 w-9 h-9 rounded-md bg-elevated border border-border/40 flex items-center justify-center text-sm font-semibold text-secondary">
      {initial}
    </div>
  );
}

function EasyApplyPill({ job, compact = false }: { job: PhilippeJob; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(Boolean(job.browser_use_session_id));
  const [error, setError] = useState<string | null>(null);
  const isEasyApply = job.apply_type === 'easy_apply';
  const canBrowserUse = isEasyApply && (job.decision === 'STRONG_APPLY' || job.decision === 'APPLY');

  const apply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canBrowserUse) {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch('/api/jobs/easy-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id }),
        });
        const data = await r.json();
        if (!r.ok || data.error) setError(data.error || `HTTP ${r.status}`);
        else setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    } else if (job.job_url) {
      // Non-easy-apply: open the posting so Philippe can apply via the company's website
      window.open(job.job_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-success bg-success/15 rounded-full" title="Submitted via Browser Use Cloud">
        <Sparkles size={11} /> {compact ? 'Queued' : 'Apply queued'}
      </span>
    );
  }

  const label = canBrowserUse
    ? (busy ? 'Submitting…' : 'Easy Apply')
    : 'Open & apply';
  const tooltip = canBrowserUse
    ? 'Submit this application automatically via Browser Use Cloud using the generated cover letter'
    : 'Open the job posting in a new tab to apply manually on the company website';
  const Icon = canBrowserUse ? Zap : Send;

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={apply}
        disabled={busy || (!canBrowserUse && !job.job_url)}
        title={tooltip}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors disabled:opacity-50 ${
          canBrowserUse
            ? 'text-success bg-success/15 hover:bg-success/25 ring-1 ring-success/40'
            : 'text-accent bg-accent/10 hover:bg-accent/20 ring-1 ring-accent/30'
        }`}
      >
        <Icon size={11} /> {label}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </span>
  );
}
