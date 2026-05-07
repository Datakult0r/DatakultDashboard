'use client';

/**
 * BumpsSurface — Big Underserved Meaningful Pain-points discovered on Reddit,
 * scored by Claude for GenAI-solvability, ranked by priority.
 *
 * The pipeline: discovered → researching → validated → building → dropped.
 * Click a row to expand; flip-style reveal of Claude's classification.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Search, ExternalLink, ChevronDown, ChevronUp, Sparkles, MessageSquare,
  TrendingUp, ArrowUpRight, RefreshCw, Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Bump {
  id: string;
  title: string;
  body: string | null;
  url: string;
  subreddit: string | null;
  author: string | null;
  upvotes: number;
  comments_count: number;
  pain_type: string | null;
  priority_score: number | null;
  matched_phrases: string[] | null;
  claude_solvability: number | null;
  claude_target_market: string | null;
  claude_summary: string | null;
  claude_product_idea: string | null;
  status: string;
  notes: string | null;
  posted_at: string | null;
  created_at: string;
}

const STATUS_ORDER = ['discovered', 'researching', 'validated', 'building', 'dropped'] as const;
type Status = typeof STATUS_ORDER[number];

const STATUS_TONE: Record<string, string> = {
  discovered: 'border-info/30 bg-info/5 text-info',
  researching: 'border-warning/30 bg-warning/5 text-warning',
  validated: 'border-accent/30 bg-accent/5 text-accent',
  building: 'border-success/30 bg-success/5 text-success',
  dropped: 'border-border/40 bg-elevated/40 text-tertiary',
};

const PAIN_TYPE_TONE: Record<string, string> = {
  'pricing': 'bg-money/15 text-money',
  'missing-features': 'bg-accent/15 text-accent',
  'workflow-friction': 'bg-warning/15 text-warning',
  'switching-tools': 'bg-info/15 text-info',
  'other': 'bg-elevated text-tertiary',
};

export default function BumpsSurface() {
  const [bumps, setBumps] = useState<Bump[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('discovered');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bumps')
      .select('*')
      .order('claude_solvability', { ascending: false, nullsFirst: false })
      .order('priority_score', { ascending: false, nullsFirst: false })
      .order('upvotes', { ascending: false })
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

  const stats = useMemo(() => ({
    total: bumps.length,
    discovered: bumps.filter((b) => b.status === 'discovered').length,
    researching: bumps.filter((b) => b.status === 'researching').length,
    validated: bumps.filter((b) => b.status === 'validated').length,
    building: bumps.filter((b) => b.status === 'building').length,
    classified: bumps.filter((b) => b.claude_solvability !== null).length,
  }), [bumps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bumps.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (!q) return true;
      const blob = `${b.title} ${b.body ?? ''} ${b.subreddit ?? ''} ${b.claude_summary ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [bumps, search, statusFilter]);

  const triggerScrape = async () => {
    setLoading(true);
    await fetch('/api/bumps/discover').catch(() => {});
    reload();
  };

  const triggerClassify = async () => {
    setLoading(true);
    await fetch('/api/bumps/classify', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Sparkles size={18} className="text-money" />
            BUMPS — Big Underserved Meaningful Pain-points
          </h3>
          <p className="text-[11px] text-tertiary mt-0.5 leading-snug max-w-2xl">
            Real user pain points scraped from 10 SaaS / startup / business subreddits, classified by pain type, scored by Claude for GenAI-solvability. Move them through your pipeline (discovered → researching → validated → building) when a candidate looks productizable.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={triggerScrape} title="Scrape new pain points from Reddit (~$0.05 / 50 results)"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-warning border border-warning/40 rounded-md px-2 py-1 hover:bg-warning/10">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Scrape
          </button>
          <button onClick={triggerClassify} title="Ask Claude to score unclassified rows (~$0.001 each)"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-accent border border-accent/40 rounded-md px-2 py-1 hover:bg-accent/10">
            <Sparkles size={11} /> Classify
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Tile label="Total" value={stats.total} tint="accent" />
        <Tile label="Discovered" value={stats.discovered} tint="info" />
        <Tile label="Researching" value={stats.researching} tint="warning" />
        <Tile label="Validated" value={stats.validated} tint="accent" />
        <Tile label="Building" value={stats.building} tint="success" />
        <Tile label="Claude scored" value={stats.classified} tint="money" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title, subreddit, Claude summary…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-elevated/40 border border-border/60 rounded-lg focus:border-accent/40 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-elevated/40 border border-border/60 rounded-lg p-0.5 flex-wrap">
          <Filter size={11} className="text-tertiary mx-1" />
          {(['all', ...STATUS_ORDER] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${
                statusFilter === s ? 'bg-accent/15 text-accent' : 'text-tertiary hover:text-secondary'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-tertiary text-sm border border-dashed border-border rounded-lg">
            No pain points match. Click Scrape to pull fresh ones from Reddit (weekly cron also runs Mondays at 08:00 Lisbon).
          </div>
        )}
        {filtered.map((bump) => (
          <BumpRow key={bump.id} bump={bump}
            isExpanded={expandedId === bump.id}
            onToggle={() => setExpandedId(expandedId === bump.id ? null : bump.id)} />
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, tint }: { label: string; value: number; tint: string }) {
  const tintMap: Record<string, string> = {
    accent: 'bg-accent/5 text-accent border-accent/15',
    info: 'bg-info/5 text-info border-info/15',
    warning: 'bg-warning/5 text-warning border-warning/15',
    success: 'bg-success/5 text-success border-success/15',
    money: 'bg-money/5 text-money border-money/15',
  };
  return (
    <div className={`rounded-lg border ${tintMap[tint] ?? tintMap.accent} px-3 py-2`}>
      <div className="text-[9px] uppercase tracking-wider text-tertiary font-mono">{label}</div>
      <div className="text-lg font-mono font-bold mt-0.5">{value}</div>
    </div>
  );
}

interface BumpRowProps { bump: Bump; isExpanded: boolean; onToggle: () => void }
function BumpRow({ bump, isExpanded, onToggle }: BumpRowProps) {
  const tone = STATUS_TONE[bump.status] ?? STATUS_TONE.discovered;
  const painTone = PAIN_TYPE_TONE[bump.pain_type ?? 'other'];
  const setStatus = async (e: React.MouseEvent, next: Status) => {
    e.stopPropagation();
    await fetch('/api/bumps/status', { method: 'POST', body: JSON.stringify({ id: bump.id, status: next }) });
  };

  return (
    <div className={`rounded-lg border transition-all ${isExpanded ? 'border-accent/40 bg-elevated/20' : 'border-border/60 bg-surface hover:border-secondary/60'}`}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3">
        {/* Solvability score chip */}
        {bump.claude_solvability !== null ? (
          <div className="shrink-0 w-12 h-12 rounded-lg bg-money/15 text-money flex flex-col items-center justify-center font-mono font-bold ring-1 ring-money/30">
            <span className="text-base leading-none">{bump.claude_solvability}</span>
            <span className="text-[8px] tracking-widest mt-0.5 opacity-70">SOLVE</span>
          </div>
        ) : (
          <div className="shrink-0 w-12 h-12 rounded-lg bg-elevated border border-border/40 flex items-center justify-center text-[9px] font-mono text-tertiary">
            unscored
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-tertiary flex-wrap">
            {bump.subreddit && <span>r/{bump.subreddit}</span>}
            {bump.pain_type && (
              <>
                <span className="opacity-30">·</span>
                <span className={`px-1.5 py-px rounded ${painTone}`}>{bump.pain_type}</span>
              </>
            )}
            {bump.priority_score !== null && (
              <>
                <span className="opacity-30">·</span>
                <span className="inline-flex items-center gap-0.5"><TrendingUp size={9} /> P{bump.priority_score.toFixed(1)}</span>
              </>
            )}
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-0.5"><ArrowUpRight size={9} />{bump.upvotes}</span>
            <span className="opacity-30">·</span>
            <span className="inline-flex items-center gap-0.5"><MessageSquare size={9} />{bump.comments_count}</span>
          </div>
          <p className="text-sm font-medium text-primary truncate mt-0.5" title={bump.title}>{bump.title}</p>
          {bump.claude_summary && (
            <p className="text-[11px] text-secondary line-clamp-1 mt-0.5">{bump.claude_summary}</p>
          )}
        </div>

        <span className={`shrink-0 inline-flex items-center px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded-md border ${tone}`}>
          {bump.status}
        </span>
        <span className="text-tertiary/60 shrink-0 ml-1">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/40 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <div className="space-y-2">
              {bump.body && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Reddit post excerpt</p>
                  <p className="text-xs text-secondary leading-relaxed line-clamp-8 whitespace-pre-wrap">{bump.body}</p>
                </div>
              )}
              {bump.matched_phrases && bump.matched_phrases.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Matched pain phrases</p>
                  <div className="flex flex-wrap gap-1">
                    {bump.matched_phrases.map((m, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-money/10 text-money font-mono">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {bump.claude_target_market && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1">Target market (Claude)</p>
                  <p className="text-xs text-primary leading-relaxed">{bump.claude_target_market}</p>
                </div>
              )}
              {bump.claude_product_idea && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-secondary/60 mb-1 flex items-center gap-1">
                    <Sparkles size={10} /> Product idea (Claude)
                  </p>
                  <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap bg-money/5 border border-money/15 rounded-md px-3 py-2">{bump.claude_product_idea}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={bump.url} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors">
                  Open on Reddit <ExternalLink size={10} />
                </a>
                <div className="inline-flex items-center gap-1 bg-elevated/40 rounded-md p-0.5">
                  {STATUS_ORDER.map((s) => (
                    <button key={s} onClick={(e) => setStatus(e, s)}
                      className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-all ${
                        bump.status === s ? STATUS_TONE[s] : 'text-tertiary hover:text-secondary'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
