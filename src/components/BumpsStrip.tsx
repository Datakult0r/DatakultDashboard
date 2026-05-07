'use client';

/**
 * BumpsStrip — compact BUMPS section embedded in NowSurface.
 *
 * Replaces the standalone BUMPS surface (per Philippe: "it can all fit in the
 * NOW screen"). Shows top N high-solvability pain points with score chip,
 * subreddit avatar, title, Claude product idea, Open on Reddit. Click "View
 * all" to flip into the existing BumpsSurface inline.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, ExternalLink, ArrowUpRight, MessageSquare, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Bump {
  id: string;
  title: string;
  url: string;
  subreddit: string | null;
  subreddit_icon_url: string | null;
  upvotes: number;
  comments_count: number;
  pain_type: string | null;
  claude_solvability: number | null;
  claude_target_market: string | null;
  claude_product_idea: string | null;
}

const PAIN_TONE: Record<string, string> = {
  'pricing':           'bg-money/15 text-money',
  'missing-features':  'bg-accent/15 text-accent',
  'workflow-friction': 'bg-warning/15 text-warning',
  'switching-tools':   'bg-info/15 text-info',
  'other':             'bg-elevated text-tertiary',
};

const TOP_N = 5;

export default function BumpsStrip() {
  const [bumps, setBumps] = useState<Bump[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { data } = await supabase
      .from('bumps')
      .select('id, title, url, subreddit, subreddit_icon_url, upvotes, comments_count, pain_type, claude_solvability, claude_target_market, claude_product_idea')
      .not('claude_solvability', 'is', null)
      .order('claude_solvability', { ascending: false })
      .limit(TOP_N);
    setBumps((data ?? []) as Bump[]);
  };

  useEffect(() => {
    reload();
    const ch = supabase.channel('bumps_strip')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bumps' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const triggerScrape = async () => {
    setBusy(true);
    try { await fetch('/api/bumps/discover'); } catch {}
    await reload();
    setBusy(false);
  };
  const triggerClassify = async () => {
    setBusy(true);
    try { await fetch('/api/bumps/classify', { method: 'POST', body: JSON.stringify({}) }); } catch {}
    await reload();
    setBusy(false);
  };

  const totals = useMemo(() => ({ shown: bumps.length }), [bumps]);

  if (totals.shown === 0) {
    return (
      <div className="rounded-xl border border-money/20 bg-money/[0.03] p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-money" />
            <h3 className="text-sm font-semibold text-primary">BUMPS</h3>
            <span className="text-[10px] text-tertiary font-mono">Big Underserved Meaningful Pain-points</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={triggerScrape} disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-warning border border-warning/40 rounded-md px-2 py-1 hover:bg-warning/10 disabled:opacity-50">
              <RefreshCw size={11} className={busy ? 'animate-spin' : ''} /> Scrape
            </button>
            <button onClick={triggerClassify} disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-accent border border-accent/40 rounded-md px-2 py-1 hover:bg-accent/10 disabled:opacity-50">
              <Sparkles size={11} className={busy ? 'animate-spin' : ''} /> Classify
            </button>
          </div>
        </div>
        <p className="text-xs text-tertiary leading-snug">
          No scored pain points yet. Click Scrape (~$0.05) then Classify (~$0.05) to populate. Weekly cron runs Mondays 08:00 Lisbon.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-money/20 bg-money/[0.03] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-money" />
          <h3 className="text-sm font-semibold text-primary">BUMPS</h3>
          <span className="text-[10px] text-tertiary font-mono uppercase tracking-wider">Top {TOP_N} by GenAI solvability</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={triggerScrape} disabled={busy} title="Pull fresh pain points"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-warning border border-warning/40 rounded-md px-2 py-1 hover:bg-warning/10 disabled:opacity-50">
            <RefreshCw size={11} className={busy ? 'animate-spin' : ''} /> Scrape
          </button>
          <button onClick={triggerClassify} disabled={busy} title="Score unclassified rows with Claude"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-accent border border-accent/40 rounded-md px-2 py-1 hover:bg-accent/10 disabled:opacity-50">
            <Sparkles size={11} className={busy ? 'animate-spin' : ''} /> Classify
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {bumps.map((b) => <BumpStripRow key={b.id} bump={b} />)}
      </ul>
    </div>
  );
}

function BumpStripRow({ bump }: { bump: Bump }) {
  const score = bump.claude_solvability ?? 0;
  const scoreColor =
    score >= 75 ? 'border-success/40 bg-success/10 text-success'
    : score >= 50 ? 'border-money/40 bg-money/10 text-money'
    : score >= 25 ? 'border-warning/40 bg-warning/10 text-warning'
    : 'border-danger/30 bg-danger/5 text-danger';
  const painTone = PAIN_TONE[bump.pain_type ?? 'other'];
  return (
    <li className="flex items-start gap-3 px-3 py-2 rounded-md bg-surface/60 border border-border/30 hover:border-money/30 transition-colors">
      {/* Subreddit avatar */}
      <SubredditAvatar bump={bump} />
      {/* Score chip */}
      <div className={`shrink-0 w-10 h-10 rounded-md border ${scoreColor} flex items-center justify-center font-mono font-bold text-sm`}>
        {score}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-tertiary">
          <span className="text-info">r/{bump.subreddit ?? 'unknown'}</span>
          {bump.pain_type && (
            <>
              <span className="opacity-30">·</span>
              <span className={`px-1.5 py-px rounded ${painTone}`}>{bump.pain_type}</span>
            </>
          )}
          <span className="opacity-30">·</span>
          <span className="inline-flex items-center gap-0.5"><ArrowUpRight size={9} />{bump.upvotes}</span>
          <span className="opacity-30">·</span>
          <span className="inline-flex items-center gap-0.5"><MessageSquare size={9} />{bump.comments_count}</span>
        </div>
        <div className="text-sm text-primary truncate mt-0.5" title={bump.title}>{bump.title}</div>
        {bump.claude_product_idea && (
          <p className="text-[11px] text-secondary line-clamp-2 mt-1">
            <span className="text-money font-mono uppercase tracking-wider text-[9px]">Idea:</span>{' '}
            {bump.claude_product_idea}
            {bump.claude_target_market && (
              <span className="text-tertiary"> — for {bump.claude_target_market}</span>
            )}
          </p>
        )}
      </div>
      <a href={bump.url} target="_blank" rel="noopener noreferrer"
         className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-info bg-info/10 hover:bg-info/20 rounded-md transition-colors self-center">
        Open <ExternalLink size={9} />
      </a>
    </li>
  );
}

function SubredditAvatar({ bump }: { bump: Bump }) {
  const [failed, setFailed] = useState(false);
  if (bump.subreddit_icon_url && !failed) {
    return (
      <img src={bump.subreddit_icon_url} alt="" loading="lazy" onError={() => setFailed(true)}
        className="shrink-0 w-9 h-9 rounded-full object-cover bg-elevated border border-border/40" />
    );
  }
  const letter = (bump.subreddit ?? '?').charAt(0).toUpperCase();
  return (
    <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
         style={{ background: 'linear-gradient(135deg,#FF4500,#FF6B6B)' }}>
      {letter}
    </div>
  );
}
