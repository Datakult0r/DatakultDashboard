'use client';

/**
 * BumpsSurface — Big Underserved Meaningful Pain-points discovered on Reddit.
 *
 * v4.7: simplified — no pipeline UI. Just a scrollable list with all the
 * pertinent info inline so Philippe can browse what was discovered without
 * having to click around. Sort + search + Reddit link is all you need.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Search, ExternalLink, Sparkles, MessageSquare, ArrowUpRight,
  RefreshCw, TrendingUp, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Bump {
  id: string;
  title: string;
  body: string | null;
  url: string;
  subreddit: string | null;
  upvotes: number;
  comments_count: number;
  pain_type: string | null;
  priority_score: number | null;
  matched_phrases: string[] | null;
  claude_solvability: number | null;
  claude_target_market: string | null;
  claude_summary: string | null;
  claude_product_idea: string | null;
  posted_at: string | null;
  created_at: string;
}

const PAIN_TYPE_TONE: Record<string, string> = {
  'pricing':            'bg-money/15 text-money',
  'missing-features':   'bg-accent/15 text-accent',
  'workflow-friction':  'bg-warning/15 text-warning',
  'switching-tools':    'bg-info/15 text-info',
  'other':              'bg-elevated text-tertiary',
};

type Sort = 'solvability' | 'priority' | 'upvotes' | 'recent';

export default function BumpsSurface() {
  const [bumps, setBumps] = useState<Bump[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('solvability');
  const [busyAction, setBusyAction] = useState<'scrape' | 'classify' | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bumps')
      .select('id, title, body, url, subreddit, upvotes, comments_count, pain_type, priority_score, matched_phrases, claude_solvability, claude_target_market, claude_summary, claude_product_idea, posted_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    setBumps((data ?? []) as Bump[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const ch = supabase.channel('bumps_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bumps' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = bumps.filter((b) => {
      if (!q) return true;
      const blob = `${b.title} ${b.body ?? ''} ${b.subreddit ?? ''} ${b.claude_summary ?? ''} ${b.claude_target_market ?? ''} ${b.claude_product_idea ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === 'solvability') return (b.claude_solvability ?? -1) - (a.claude_solvability ?? -1);
      if (sort === 'priority')    return (b.priority_score ?? -1) - (a.priority_score ?? -1);
      if (sort === 'upvotes')     return b.upvotes - a.upvotes;
      return new Date(b.posted_at ?? b.created_at).getTime() - new Date(a.posted_at ?? a.created_at).getTime();
    });
    return sorted;
  }, [bumps, search, sort]);

  const triggerScrape = async () => {
    setBusyAction('scrape');
    try { await fetch('/api/bumps/discover'); } catch {}
    await reload();
    setBusyAction(null);
  };
  const triggerClassify = async () => {
    setBusyAction('classify');
    try { await fetch('/api/bumps/classify', { method: 'POST', body: JSON.stringify({}) }); } catch {}
    await reload();
    setBusyAction(null);
  };

  const classifiedCount = useMemo(() => bumps.filter((b) => b.claude_solvability !== null).length, [bumps]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Sparkles size={18} className="text-money" /> BUMPS
          </h3>
          <p className="text-[11px] text-tertiary mt-0.5 leading-snug max-w-2xl">
            Big Underserved Meaningful Pain-points scraped from 10 subreddits (SaaS / startups / Entrepreneur / smallbusiness / marketing / sales / recruiting / Accounting / legaladvice / freelance). Cron runs every Monday 08:00 Lisbon. Claude scores each one 0-100 for GenAI solvability and proposes a product idea.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={triggerScrape} disabled={busyAction === 'scrape'}
            title="Scrape new pain points from Reddit (~$0.05 / 50 results)"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-warning border border-warning/40 rounded-md px-2 py-1 hover:bg-warning/10 disabled:opacity-50">
            <RefreshCw size={11} className={busyAction === 'scrape' ? 'animate-spin' : ''} />
            Scrape
          </button>
          <button onClick={triggerClassify} disabled={busyAction === 'classify'}
            title="Ask Claude to score unclassified rows (~$0.001 each, max 20 per click)"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-accent border border-accent/40 rounded-md px-2 py-1 hover:bg-accent/10 disabled:opacity-50">
            <Sparkles size={11} className={busyAction === 'classify' ? 'animate-spin' : ''} />
            Classify
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, body, Claude summary, product idea, target market…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-elevated/40 border border-border/60 rounded-lg focus:border-accent/40 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-elevated/40 border border-border/60 rounded-lg p-0.5">
          {([
            ['solvability', 'Solvability'],
            ['priority',    'Priority'],
            ['upvotes',     'Upvotes'],
            ['recent',      'Newest'],
          ] as Array<[Sort, string]>).map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${
                sort === k ? 'bg-accent/15 text-accent' : 'text-tertiary hover:text-secondary'
              }`}>{label}</button>
          ))}
        </div>
        <span className="text-[10px] font-mono text-tertiary px-2">
          {bumps.length} total · {classifiedCount} scored
        </span>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-tertiary text-sm border border-dashed border-border rounded-lg">
            <Sparkles size={18} className="mx-auto mb-1 opacity-40" />
            <p>No pain points match. Click Scrape to pull fresh ones.</p>
            <p className="text-[10px] mt-1 opacity-70">Weekly cron: Mondays 08:00 Lisbon.</p>
          </div>
        )}
        {filtered.map((bump) => <BumpCard key={bump.id} bump={bump} />)}
      </div>
    </div>
  );
}

function BumpCard({ bump }: { bump: Bump }) {
  const painTone = PAIN_TYPE_TONE[bump.pain_type ?? 'other'];
  const score = bump.claude_solvability;
  const scoreColor = score === null ? 'border-border/40 bg-elevated/30 text-tertiary'
    : score >= 75 ? 'border-success/40 bg-success/10 text-success'
    : score >= 50 ? 'border-money/40 bg-money/10 text-money'
    : score >= 25 ? 'border-warning/40 bg-warning/10 text-warning'
    : 'border-danger/30 bg-danger/5 text-danger';

  return (
    <article className="rounded-lg border border-border/60 bg-surface hover:border-secondary/60 transition-colors p-4">
      <div className="flex items-start gap-3">
        {/* Solvability score chip */}
        <div className={`shrink-0 w-14 h-14 rounded-lg border-2 ${scoreColor} flex flex-col items-center justify-center font-mono font-bold`}>
          <span className="text-lg leading-none">{score ?? '–'}</span>
          <span className="text-[8px] tracking-widest mt-0.5 opacity-70">SOLVE</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Top meta line */}
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-tertiary flex-wrap">
            {bump.subreddit && <span className="text-info">r/{bump.subreddit}</span>}
            {bump.pain_type && (<><span className="opacity-30">·</span>
              <span className={`px-1.5 py-px rounded ${painTone}`}>{bump.pain_type}</span></>)}
            {bump.priority_score !== null && (<><span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-0.5"><TrendingUp size={9} />P{bump.priority_score.toFixed(1)}</span></>)}
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-0.5"><ArrowUpRight size={9} />{bump.upvotes}</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-0.5"><MessageSquare size={9} />{bump.comments_count}</span>
            {bump.posted_at && (<><span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-0.5"><Calendar size={9} />{formatDistanceToNow(new Date(bump.posted_at), { addSuffix: true })}</span></>)}
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-primary leading-snug mt-1.5">{bump.title}</h4>

          {/* Claude summary (if available) — most useful one-liner */}
          {bump.claude_summary && (
            <p className="text-xs text-secondary leading-relaxed mt-1.5">{bump.claude_summary}</p>
          )}

          {/* Body excerpt fallback — only if no Claude summary */}
          {!bump.claude_summary && bump.body && (
            <p className="text-xs text-secondary leading-relaxed mt-1.5 line-clamp-3 whitespace-pre-wrap">{bump.body}</p>
          )}

          {/* Claude product idea — the actual value */}
          {bump.claude_product_idea && (
            <div className="mt-3 rounded-md border border-money/20 bg-money/[0.04] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-money font-mono mb-1">
                <Sparkles size={10} /> Product idea
                {bump.claude_target_market && (
                  <span className="text-tertiary normal-case tracking-normal font-normal ml-1">· for {bump.claude_target_market}</span>
                )}
              </div>
              <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">{bump.claude_product_idea}</p>
            </div>
          )}

          {/* Matched pain phrases (just chips, no clutter) */}
          {bump.matched_phrases && bump.matched_phrases.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {bump.matched_phrases.slice(0, 6).map((m, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-elevated text-tertiary font-mono">{m}</span>
              ))}
            </div>
          )}

          {/* Single CTA */}
          <div className="mt-3">
            <a href={bump.url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-info bg-info/10 hover:bg-info/20 rounded-md transition-colors">
              Open on Reddit <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
