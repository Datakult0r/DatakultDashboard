'use client';

/**
 * BumpsSurface — master/detail layout for Big Underserved Meaningful Pain-points.
 *
 * Left: scrollable list (subreddit icon + title + score chip).
 * Right: full detail panel with all scrape info — title, body, comment signals,
 *        Claude classification, matched phrases, posted date, engagement ratio,
 *        source mode, link to Reddit.
 *
 * One subtle animation: the detail panel slides+fades when selection changes.
 * No pipeline UI per Philippe's request.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Search, ExternalLink, Sparkles, MessageSquare, ArrowUpRight,
  RefreshCw, TrendingUp, Calendar, User, Globe, Quote,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Bump {
  id: string;
  title: string;
  body: string | null;
  url: string;
  subreddit: string | null;
  subreddit_icon_url: string | null;
  author: string | null;
  author_url: string | null;
  upvotes: number;
  comments_count: number;
  engagement_ratio: number | null;
  pain_type: string | null;
  priority_score: number | null;
  classification_confidence: number | null;
  matched_phrases: string[] | null;
  pain_summary: string | null;
  comment_signals: Array<{ author?: string; text?: string; score?: number }> | null;
  source_mode: string | null;
  claude_solvability: number | null;
  claude_target_market: string | null;
  claude_summary: string | null;
  claude_product_idea: string | null;
  posted_at: string | null;
  created_at: string;
}

const PAIN_TYPE_TONE: Record<string, string> = {
  'pricing':            'bg-money/15 text-money border-money/30',
  'missing-features':   'bg-accent/15 text-accent border-accent/30',
  'workflow-friction':  'bg-warning/15 text-warning border-warning/30',
  'switching-tools':    'bg-info/15 text-info border-info/30',
  'other':              'bg-elevated text-tertiary border-border/40',
};

type Sort = 'solvability' | 'priority' | 'upvotes' | 'recent';

export default function BumpsSurface() {
  const [bumps, setBumps] = useState<Bump[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('solvability');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'scrape' | 'classify' | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bumps')
      .select('*')
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
    const arr = bumps.filter((b) => {
      if (!q) return true;
      const blob = `${b.title} ${b.body ?? ''} ${b.subreddit ?? ''} ${b.claude_summary ?? ''} ${b.claude_target_market ?? ''} ${b.claude_product_idea ?? ''} ${b.pain_summary ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
    arr.sort((a, b) => {
      if (sort === 'solvability') return (b.claude_solvability ?? -1) - (a.claude_solvability ?? -1);
      if (sort === 'priority')    return (b.priority_score ?? -1) - (a.priority_score ?? -1);
      if (sort === 'upvotes')     return b.upvotes - a.upvotes;
      return new Date(b.posted_at ?? b.created_at).getTime() - new Date(a.posted_at ?? a.created_at).getTime();
    });
    return arr;
  }, [bumps, search, sort]);

  // Auto-select the first item if nothing's selected
  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = useMemo(() => filtered.find((b) => b.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);

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
    <div className="space-y-3">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Sparkles size={18} className="text-money" /> BUMPS
          </h3>
          <p className="text-[11px] text-tertiary mt-0.5 leading-snug max-w-3xl">
            Pain-points from 10 subreddits. Cron Mondays 08:00 Lisbon. Claude scores GenAI-solvability and proposes a product. Click a row on the left to read the full scrape on the right.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={triggerScrape} disabled={busyAction === 'scrape'}
            title="Pull fresh pain points from Reddit (~$0.05 / 50 results)"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-warning border border-warning/40 rounded-md px-2 py-1 hover:bg-warning/10 disabled:opacity-50">
            <RefreshCw size={11} className={busyAction === 'scrape' ? 'animate-spin' : ''} />
            Scrape
          </button>
          <button onClick={triggerClassify} disabled={busyAction === 'classify'}
            title="Score unclassified rows with Claude Haiku (~$0.001 each, 20 max per click)"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-accent border border-accent/40 rounded-md px-2 py-1 hover:bg-accent/10 disabled:opacity-50">
            <Sparkles size={11} className={busyAction === 'classify' ? 'animate-spin' : ''} />
            Classify
          </button>
        </div>
      </div>

      {/* Search + sort */}
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
        <span className="text-[10px] font-mono text-tertiary px-2 whitespace-nowrap">
          {filtered.length} / {bumps.length} · {classifiedCount} scored
        </span>
      </div>

      {/* Master/detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 min-h-[600px]">
        {/* LEFT — scrollable list */}
        <aside className="rounded-xl border border-border/40 bg-surface/50 overflow-hidden flex flex-col max-h-[calc(100vh-200px)] sticky top-[140px]">
          <div className="overflow-y-auto flex-1 divide-y divide-border/30">
            {filtered.length === 0 && !loading && (
              <div className="text-center py-12 text-tertiary text-sm px-4">
                <Sparkles size={18} className="mx-auto mb-1 opacity-40" />
                <p>No pain points yet.</p>
                <p className="text-[10px] mt-1 opacity-70">Click Scrape, or wait for Monday's cron.</p>
              </div>
            )}
            {filtered.map((bump) => (
              <BumpListItem key={bump.id} bump={bump}
                isSelected={selected?.id === bump.id}
                onClick={() => setSelectedId(bump.id)} />
            ))}
          </div>
        </aside>

        {/* RIGHT — detail panel with subtle slide+fade animation on selection change */}
        <section className="min-w-0">
          {selected ? (
            <BumpDetail key={selected.id} bump={selected} />
          ) : (
            <div className="rounded-xl border border-dashed border-border/40 h-full flex items-center justify-center text-tertiary text-sm">
              Select a pain point on the left.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface BumpListItemProps { bump: Bump; isSelected: boolean; onClick: () => void }
function BumpListItem({ bump, isSelected, onClick }: BumpListItemProps) {
  const score = bump.claude_solvability;
  const scoreColor =
    score === null  ? 'bg-elevated/60 text-tertiary border-border/40'
    : score >= 75   ? 'bg-success/15 text-success border-success/40'
    : score >= 50   ? 'bg-money/15 text-money border-money/40'
    : score >= 25   ? 'bg-warning/15 text-warning border-warning/40'
                    : 'bg-danger/10 text-danger border-danger/30';
  return (
    <button onClick={onClick}
      className={`group w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors relative ${
        isSelected ? 'bg-accent/8' : 'hover:bg-elevated/40'
      }`}>
      {/* Active marker */}
      {isSelected && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-accent shadow-[0_0_6px_rgba(125,211,160,0.4)]" />
      )}
      <SubredditAvatar bump={bump} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-wider text-tertiary truncate">
          r/{bump.subreddit ?? 'unknown'}
        </div>
        <div className={`text-xs leading-snug line-clamp-2 mt-0.5 ${isSelected ? 'text-primary font-medium' : 'text-secondary'}`}>
          {bump.title}
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-tertiary/80 mt-1">
          <span className="inline-flex items-center gap-0.5"><ArrowUpRight size={8} />{bump.upvotes}</span>
          <span className="inline-flex items-center gap-0.5"><MessageSquare size={8} />{bump.comments_count}</span>
        </div>
      </div>
      <div className={`shrink-0 w-9 h-9 rounded-md border ${scoreColor} flex flex-col items-center justify-center font-mono font-bold`}>
        <span className="text-xs leading-none">{score ?? '–'}</span>
      </div>
    </button>
  );
}

function SubredditAvatar({ bump }: { bump: Bump }) {
  const [failed, setFailed] = useState(false);
  if (bump.subreddit_icon_url && !failed) {
    return (
      <img
        src={bump.subreddit_icon_url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 w-9 h-9 rounded-full object-cover bg-elevated border border-border/40"
      />
    );
  }
  // Reddit-orange fallback bubble with the subreddit's first letter
  const letter = (bump.subreddit ?? '?').charAt(0).toUpperCase();
  return (
    <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
         style={{ background: 'linear-gradient(135deg,#FF4500,#FF6B6B)' }}>
      {letter}
    </div>
  );
}

function BumpDetail({ bump }: { bump: Bump }) {
  const score = bump.claude_solvability;
  const scoreColor =
    score === null  ? 'border-border/40 bg-elevated/30 text-tertiary'
    : score >= 75   ? 'border-success/40 bg-success/10 text-success'
    : score >= 50   ? 'border-money/40 bg-money/10 text-money'
    : score >= 25   ? 'border-warning/40 bg-warning/10 text-warning'
                    : 'border-danger/30 bg-danger/5 text-danger';
  const painTone = PAIN_TYPE_TONE[bump.pain_type ?? 'other'];

  return (
    <article className="rounded-xl border border-border/60 bg-surface p-5 sm:p-6 animate-bump-detail-enter">
      {/* Header — score chip + meta line */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`shrink-0 w-16 h-16 rounded-xl border-2 ${scoreColor} flex flex-col items-center justify-center font-mono font-bold`}>
          <span className="text-2xl leading-none">{score ?? '–'}</span>
          <span className="text-[8px] tracking-widest mt-0.5 opacity-70">SOLVE</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-tertiary flex-wrap">
            <SubredditAvatar bump={bump} />
            <span className="text-info text-xs normal-case tracking-normal font-semibold">r/{bump.subreddit}</span>
            {bump.pain_type && (
              <span className={`px-2 py-0.5 rounded border ${painTone}`}>{bump.pain_type}</span>
            )}
            {bump.priority_score !== null && (
              <span className="inline-flex items-center gap-0.5"><TrendingUp size={10} /> P{bump.priority_score.toFixed(2)}</span>
            )}
            {bump.classification_confidence !== null && (
              <span title="Actor classification confidence">conf {Math.round((bump.classification_confidence ?? 0) * 100)}%</span>
            )}
            {bump.source_mode && (
              <span title="How the actor fetched the post"><Globe size={10} className="inline" /> {bump.source_mode}</span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-primary leading-tight mt-2">{bump.title}</h2>
          <div className="flex items-center gap-3 text-[11px] text-secondary mt-2 flex-wrap">
            {bump.author && (
              bump.author_url ? (
                <a href={bump.author_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent transition-colors">
                  <User size={11} /> u/{bump.author} <ExternalLink size={9} />
                </a>
              ) : <span className="inline-flex items-center gap-1"><User size={11} /> u/{bump.author}</span>
            )}
            {bump.posted_at && (
              <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatDistanceToNow(new Date(bump.posted_at), { addSuffix: true })}</span>
            )}
            <span className="inline-flex items-center gap-1"><ArrowUpRight size={11} /> {bump.upvotes}{bump.engagement_ratio ? ` (${Math.round((bump.engagement_ratio ?? 0) * 100)}%)` : ''}</span>
            <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> {bump.comments_count}</span>
          </div>
        </div>
        <a href={bump.url} target="_blank" rel="noopener noreferrer"
           className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-info bg-info/10 hover:bg-info/20 rounded-md transition-colors">
          Reddit <ExternalLink size={11} />
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT col — original Reddit content + comment signals */}
        <div className="space-y-4">
          {/* Pain summary from the actor */}
          {bump.pain_summary && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-secondary/60 font-mono mb-1.5">Actor pain summary</div>
              <p className="text-sm text-secondary leading-relaxed bg-elevated/30 border border-border/40 rounded-md px-3 py-2">{bump.pain_summary}</p>
            </div>
          )}
          {bump.body && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-secondary/60 font-mono mb-1.5">Reddit post body</div>
              <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap line-clamp-[18]">{bump.body}</p>
            </div>
          )}
          {bump.matched_phrases && bump.matched_phrases.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-secondary/60 font-mono mb-1.5">Matched pain phrases</div>
              <div className="flex flex-wrap gap-1">
                {bump.matched_phrases.map((m, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-money/10 text-money font-mono border border-money/20">{m}</span>
                ))}
              </div>
            </div>
          )}
          {bump.comment_signals && bump.comment_signals.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-secondary/60 font-mono mb-1.5 flex items-center gap-1">
                <Quote size={10} /> Top comments showing pain
              </div>
              <ul className="space-y-2">
                {bump.comment_signals.slice(0, 4).map((c, i) => (
                  <li key={i} className="text-xs bg-elevated/40 border-l-2 border-money/40 pl-3 py-1.5 pr-2 rounded-r">
                    <div className="text-tertiary text-[10px] font-mono mb-0.5">u/{c.author ?? 'anon'} {c.score !== undefined && `· ${c.score}`}</div>
                    <p className="text-secondary leading-snug">{c.text?.slice(0, 280)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT col — Claude classification */}
        <div className="space-y-4">
          {bump.claude_summary && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-accent/80 font-mono mb-1.5 flex items-center gap-1">
                <Sparkles size={10} /> Claude pain summary
              </div>
              <p className="text-sm text-primary leading-relaxed bg-accent/5 border border-accent/15 rounded-md px-3 py-2">{bump.claude_summary}</p>
            </div>
          )}
          {bump.claude_target_market && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-secondary/60 font-mono mb-1.5">Target market</div>
              <p className="text-sm text-primary leading-relaxed">{bump.claude_target_market}</p>
            </div>
          )}
          {bump.claude_product_idea ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-money/80 font-mono mb-1.5 flex items-center gap-1">
                <Sparkles size={10} /> Product idea
              </div>
              <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap bg-money/5 border border-money/20 rounded-md px-3 py-2.5">{bump.claude_product_idea}</p>
            </div>
          ) : (
            <div className="text-xs text-tertiary px-3 py-3 border border-dashed border-border/40 rounded-md text-center">
              <Sparkles size={14} className="mx-auto mb-1 opacity-40" />
              <p>Not yet scored by Claude.</p>
              <p className="text-[10px] mt-1 opacity-70">Click the Classify button at the top to score the next 20.</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
