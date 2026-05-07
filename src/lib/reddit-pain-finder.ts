/**
 * Reddit Pain Finder — wraps solutionssmart/reddit-pain-finder Apify actor.
 *
 * Source: https://apify.com/solutionssmart/reddit-pain-finder
 * Actor ID: ju0IpllH7CrrZTZ6M
 *
 * Why: surfaces real user pain points across SaaS / startup / business
 * subreddits. Filters promotional noise, classifies pain type
 * (pricing / missing-features / workflow-friction / switching-tools), ranks
 * by priority. Feeds the BUMPS section of the dashboard.
 *
 * Pricing: $0.00005 actor start + $0.001 per result.
 *   50 results/week × $0.001 = $0.05/week = ~$0.20/month.
 *
 * Mode: works without Reddit API keys (public JSON / RSS) — no OAuth needed.
 */

const ACTOR_ID = 'solutionssmart~reddit-pain-finder';

export interface PainPoint {
  redditId: string;
  title: string;
  body: string | null;
  url: string;
  subreddit: string | null;
  author: string | null;
  postedAt: string | null;
  upvotes: number;
  commentsCount: number;
  painType: 'pricing' | 'missing-features' | 'workflow-friction' | 'switching-tools' | 'other' | null;
  priorityScore: number | null;
  matchedPhrases: string[];
}

export interface PainFinderResult {
  items: PainPoint[];
  durationMs: number;
  error: string | null;
}

interface RawPainItem {
  id?: string;
  postId?: string;
  title?: string;
  selftext?: string;
  body?: string;
  text?: string;
  url?: string;
  permalink?: string;
  subreddit?: string;
  author?: string;
  createdAt?: string;
  created?: string;
  posted_at?: string;
  ups?: number;
  upvotes?: number;
  score?: number;
  numComments?: number;
  num_comments?: number;
  painType?: string;
  pain_type?: string;
  classification?: string;
  priority?: number;
  priorityScore?: number;
  priority_score?: number;
  matchedPhrases?: string[];
  matched_phrases?: string[];
  matchedKeywords?: string[];
}

const SUBREDDITS_DEFAULT = [
  'SaaS',
  'startups',
  'Entrepreneur',
  'smallbusiness',
  'marketing',
  'sales',
  'recruiting',
  'Accounting',
  'legaladvice',
  'freelance',
];

const PAIN_KEYWORDS_DEFAULT = [
  'pain',
  'frustrating',
  'manually',
  'manual',
  'spreadsheet',
  'no good tool',
  'no good solution',
  'wish there was',
  'spending hours',
  'too expensive',
  'switching from',
  'hate using',
  'broken',
  'workaround',
];

function normalizePainType(raw: string | undefined): PainPoint['painType'] {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/[_\s]/g, '-');
  if (v.includes('pric')) return 'pricing';
  if (v.includes('missing') || v.includes('feature')) return 'missing-features';
  if (v.includes('workflow') || v.includes('friction')) return 'workflow-friction';
  if (v.includes('switch')) return 'switching-tools';
  return 'other';
}

function shape(raw: RawPainItem): PainPoint | null {
  const id = raw.id ?? raw.postId;
  const title = raw.title;
  const url = raw.url ?? (raw.permalink ? `https://reddit.com${raw.permalink}` : undefined);
  if (!id || !title || !url) return null;
  return {
    redditId: id,
    title,
    body: raw.selftext ?? raw.body ?? raw.text ?? null,
    url,
    subreddit: raw.subreddit ?? null,
    author: raw.author ?? null,
    postedAt: raw.createdAt ?? raw.created ?? raw.posted_at ?? null,
    upvotes: raw.ups ?? raw.upvotes ?? raw.score ?? 0,
    commentsCount: raw.numComments ?? raw.num_comments ?? 0,
    painType: normalizePainType(raw.painType ?? raw.pain_type ?? raw.classification),
    priorityScore: raw.priority ?? raw.priorityScore ?? raw.priority_score ?? null,
    matchedPhrases: raw.matchedPhrases ?? raw.matched_phrases ?? raw.matchedKeywords ?? [],
  };
}

interface ActorInput {
  subreddits: string[];
  keywords: string[];
  maxResults?: number;
  sortBy?: 'new' | 'hot' | 'top';
  timeframe?: 'day' | 'week' | 'month' | 'year';
  dataSourceMode?: 'auto' | 'public' | 'oauth';
  enableComments?: boolean;
  apiRateLimit?: number;
  publicRateLimit?: number;
}

export interface DiscoverOptions {
  subreddits?: string[];
  keywords?: string[];
  maxResults?: number;
  timeframe?: 'day' | 'week' | 'month' | 'year';
}

export async function discoverPainPoints(opts: DiscoverOptions = {}): Promise<PainFinderResult> {
  const apiToken = process.env.APIFY_API_TOKEN;
  const start = Date.now();
  if (!apiToken) {
    return { items: [], durationMs: 0, error: 'APIFY_API_TOKEN missing' };
  }

  const input: ActorInput = {
    subreddits: opts.subreddits ?? SUBREDDITS_DEFAULT,
    keywords: opts.keywords ?? PAIN_KEYWORDS_DEFAULT,
    maxResults: opts.maxResults ?? 50,
    sortBy: 'new',
    timeframe: opts.timeframe ?? 'week',
    dataSourceMode: 'auto',
    enableComments: false,
    apiRateLimit: 1,
    publicRateLimit: 1,
  };

  try {
    const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}&timeout=300`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(310_000),
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 500);
      return { items: [], durationMs: Date.now() - start, error: `Reddit Pain Finder ${r.status}: ${detail}` };
    }

    const data = (await r.json()) as RawPainItem[];
    const items: PainPoint[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(data) ? data : []) {
      const p = shape(raw);
      if (!p) continue;
      if (seen.has(p.redditId)) continue;
      seen.add(p.redditId);
      items.push(p);
    }

    return { items, durationMs: Date.now() - start, error: null };
  } catch (err) {
    return {
      items: [],
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
