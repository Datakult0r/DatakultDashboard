'use client';

/**
 * NewsSurface — Perplexity-style news feed for the dashboard.
 *
 * Reads triage_items where category='news' (populated by Perplexity Sonar Pro
 * during the daily 08:00 Lisbon cron — see /api/triage/collect news block).
 *
 * Layout mimics perplexity.ai/discover For You:
 *   • Top tabs: For You / Top / Topics
 *   • Hero card (1st item) — large image + title + summary + source-count chip
 *   • 3-column medium-card grid
 *   • Alternating wide image+text cards
 *   • Right rail — Today's Stats, Top Sources
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink, Heart, MoreHorizontal, Newspaper, Calendar, TrendingUp,
  Sparkles, Briefcase, Target, Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { TriageItem } from '@/types/triage';

type Tab = 'for-you' | 'top' | 'topics';

type NewsItem = TriageItem;

export default function NewsSurface() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('for-you');

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('triage_items')
      .select('*')
      .eq('category', 'news')
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(60);
    setItems((data ?? []) as NewsItem[]);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const ch = supabase.channel('news_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'triage_items', filter: 'category=eq.news' }, reload)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  // Sort according to tab
  const sorted = useMemo(() => {
    const arr = [...items];
    if (tab === 'top') {
      arr.sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
    } else {
      // for-you / topics — by recency
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [items, tab]);

  const hero = sorted[0];
  const trio = sorted.slice(1, 4);
  const tail = sorted.slice(4);

  // Source counts for the right rail
  const sourceCounts = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((i) => {
      const src = i.news_source ?? 'Unknown';
      m.set(src, (m.get(src) ?? 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Top tabs — Perplexity style */}
      <div className="flex items-center gap-6 justify-center text-sm border-b border-border/30 pb-2">
        {([
          ['for-you', 'For You'],
          ['top', 'Top'],
          ['topics', 'Topics'],
        ] as Array<[Tab, string]>).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`relative pb-2 transition-colors ${
              tab === k ? 'text-primary font-medium' : 'text-tertiary hover:text-secondary'
            }`}>
            {label}
            {tab === k && <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-accent rounded-full" />}
          </button>
        ))}
      </div>

      {/* Body — 2-column dense layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* MAIN column */}
        <div className="space-y-6 min-w-0">
          {!loading && sorted.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/40 p-12 text-center text-tertiary text-sm">
              <Newspaper size={20} className="mx-auto mb-2 opacity-40" />
              <p>No news items yet. Perplexity discovers ~14/day in the 08:00 Lisbon cron.</p>
            </div>
          )}

          {hero && <HeroNewsCard item={hero} />}

          {trio.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {trio.map((item) => <MediumNewsCard key={item.id} item={item} />)}
            </div>
          )}

          {tail.length > 0 && (
            <div className="space-y-6">
              {tail.map((item, i) => (
                <WideNewsCard key={item.id} item={item} flipped={i % 2 === 1} />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT rail */}
        <aside className="space-y-3 lg:sticky lg:top-[140px]">
          <TodayStats />
          <TopSources sources={sourceCounts} />
          <TrendingMarkets />
        </aside>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Hero
function HeroNewsCard({ item }: { item: NewsItem }) {
  const url = item.source_url ?? null;
  return (
    <article className="rounded-xl overflow-hidden border border-border/30 hover:border-secondary/50 transition-colors group">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_45%] gap-0">
        <div className="p-5 sm:p-6 flex flex-col">
          <h2 className="text-xl sm:text-2xl font-semibold text-primary leading-tight tracking-tight">{item.title}</h2>
          <div className="text-[11px] text-tertiary font-mono mt-2 inline-flex items-center gap-1">
            <Calendar size={11} /> Published {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </div>
          {item.subtitle && (
            <p className="text-sm text-secondary leading-relaxed mt-3 line-clamp-4">{item.subtitle}</p>
          )}
          <div className="mt-auto pt-4 flex items-center justify-between">
            <SourcesChip source={item.news_source} tags={item.tags} />
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-tertiary hover:text-danger rounded transition-colors" title="Save">
                <Heart size={14} />
              </button>
              <button className="p-1.5 text-tertiary hover:text-secondary rounded transition-colors" title="More">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>
        </div>
        <a href={url ?? '#'} target="_blank" rel="noopener noreferrer"
           className="relative bg-elevated min-h-[200px] md:min-h-[280px] block overflow-hidden">
          <NewsImage src={item.news_image_url} alt={item.title} fallback={item.title} />
          {url && (
            <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
              <ExternalLink size={10} />
            </span>
          )}
        </a>
      </div>
    </article>
  );
}

// -------------------------------------------------------------- Medium
function MediumNewsCard({ item }: { item: NewsItem }) {
  const url = item.source_url ?? '#';
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="rounded-xl overflow-hidden border border-border/30 hover:border-secondary/50 transition-colors group flex flex-col">
      <div className="bg-elevated aspect-[16/9] overflow-hidden">
        <NewsImage src={item.news_image_url} alt={item.title} fallback={item.title} />
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-sm font-medium text-primary leading-snug line-clamp-3 group-hover:text-accent transition-colors">{item.title}</h3>
        <div className="mt-auto pt-2 flex items-center justify-between">
          <SourcesChip source={item.news_source} tags={item.tags} compact />
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="p-1 text-tertiary/60 hover:text-danger rounded transition-colors">
            <Heart size={12} />
          </button>
        </div>
      </div>
    </a>
  );
}

// -------------------------------------------------------------- Wide
function WideNewsCard({ item, flipped }: { item: NewsItem; flipped: boolean }) {
  const url = item.source_url ?? null;
  return (
    <article className="rounded-xl overflow-hidden border-t border-border/30 pt-6">
      <div className={`grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 ${flipped ? 'md:[direction:rtl]' : ''}`}>
        <div className="md:[direction:ltr]">
          <h3 className="text-xl font-semibold text-primary leading-tight tracking-tight">{item.title}</h3>
          <div className="text-[11px] text-tertiary font-mono mt-2 inline-flex items-center gap-1">
            <Calendar size={11} /> Published {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </div>
          {item.subtitle && (
            <p className="text-sm text-secondary leading-relaxed mt-3 line-clamp-4">{item.subtitle}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <SourcesChip source={item.news_source} tags={item.tags} />
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 text-[11px] font-mono text-info hover:underline">
                Read source <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
             className="bg-elevated rounded-lg overflow-hidden aspect-[16/9] md:[direction:ltr] block">
            <NewsImage src={item.news_image_url} alt={item.title} fallback={item.title} />
          </a>
        )}
      </div>
    </article>
  );
}

// -------------------------------------------------------------- Helpers
function NewsImage({ src, alt, fallback }: { src: string | null | undefined; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-elevated to-surface text-tertiary">
        <div className="text-center px-4">
          <Newspaper size={28} className="mx-auto mb-1 opacity-30" />
          <span className="text-[10px] font-mono uppercase tracking-wider line-clamp-2">{fallback.slice(0, 60)}</span>
        </div>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}
    className="w-full h-full object-cover transition-transform group-hover:scale-105" />;
}

function SourcesChip({ source, tags, compact = false }: { source: string | null | undefined; tags: string[] | null; compact?: boolean }) {
  const count = (tags?.filter((t) => !['ai_news', 'event', 'competition', 'thought_leadership', 'market_trend'].includes(t)).length ?? 0) + (source ? 1 : 0);
  return (
    <div className={`inline-flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-tertiary font-mono`}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-elevated text-secondary text-[8px] font-bold">{Math.max(1, count)}</span>
      {source ?? 'source'}{count > 1 ? `s` : ''}
    </div>
  );
}

// -------------------------------------------------------------- Right rail tiles
function TodayStats() {
  const [stats, setStats] = useState({ jobs: 0, leads: 0, news: 0, events: 0 });
  useEffect(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    (async () => {
      const sinceISO = today.toISOString();
      const [j, l, n, e] = await Promise.all([
        supabase.from('philippe_jobs').select('id', { count: 'exact', head: true }).gte('created_at', sinceISO),
        supabase.from('customer_engagements').select('id', { count: 'exact', head: true }).gte('created_at', sinceISO),
        supabase.from('triage_items').select('id', { count: 'exact', head: true }).eq('category', 'news').gte('created_at', sinceISO),
        supabase.from('triage_items').select('id', { count: 'exact', head: true }).eq('category', 'event').gte('created_at', sinceISO),
      ]);
      setStats({
        jobs: j.count ?? 0, leads: l.count ?? 0,
        news: n.count ?? 0, events: e.count ?? 0,
      });
    })();
  }, []);
  return (
    <div className="rounded-xl border border-border/40 bg-surface p-4">
      <h3 className="text-[11px] font-semibold text-tertiary uppercase tracking-wider mb-3 inline-flex items-center gap-1">
        <Activity size={11} /> Today
      </h3>
      <ul className="space-y-2 text-xs">
        <li className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-secondary"><Briefcase size={11} className="text-info" /> Jobs scored</span><span className="font-mono text-primary">{stats.jobs}</span></li>
        <li className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-secondary"><Target size={11} className="text-accent" /> New leads</span><span className="font-mono text-primary">{stats.leads}</span></li>
        <li className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-secondary"><Newspaper size={11} className="text-money" /> News items</span><span className="font-mono text-primary">{stats.news}</span></li>
        <li className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-secondary"><Calendar size={11} className="text-success" /> AI events</span><span className="font-mono text-primary">{stats.events}</span></li>
      </ul>
    </div>
  );
}

function TopSources({ sources }: { sources: Array<[string, number]> }) {
  if (sources.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/40 bg-surface p-4">
      <h3 className="text-[11px] font-semibold text-tertiary uppercase tracking-wider mb-3 inline-flex items-center gap-1">
        <TrendingUp size={11} /> Top Sources
      </h3>
      <ul className="space-y-2 text-xs">
        {sources.map(([name, count]) => (
          <li key={name} className="flex items-center justify-between gap-2">
            <span className="text-secondary truncate" title={name}>{name}</span>
            <span className="font-mono text-tertiary tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendingMarkets() {
  return (
    <div className="rounded-xl border border-border/40 bg-surface p-4">
      <h3 className="text-[11px] font-semibold text-tertiary uppercase tracking-wider mb-3 inline-flex items-center gap-1">
        <Sparkles size={11} /> Pipeline pulse
      </h3>
      <p className="text-[11px] text-tertiary leading-snug">
        News from 7 sources today. Auto-refresh tomorrow at 08:00 Lisbon.
      </p>
    </div>
  );
}
