/**
 * Firecrawl integration for news intelligence, content source scraping,
 * and career page URL extraction.
 *
 * CANNOT scrape LinkedIn (0% success rate — confirmed by benchmarks).
 * Excellent for blogs, news sites, Substack (85-98% success).
 */

interface FirecrawlPage {
  url: string;
  title: string;
  markdown: string;
  metadata: Record<string, string>;
}

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedAt: string | null;
  category: 'ai_news' | 'event' | 'competition' | 'thought_leadership';
  location: string | null;
  eventDate: string | null;
}

interface ContentSource {
  title: string;
  body: string;
  url: string;
  sourceName: string;
  publishedAt: string | null;
}

interface FirecrawlResult {
  news: NewsItem[];
  contentSources: ContentSource[];
  durationMs: number;
  error: string | null;
}

/** News sources to scrape daily */
const NEWS_SOURCES: Array<{ url: string; name: string; category: NewsItem['category'] }> = [
  { url: 'https://alphasignal.ai', name: 'Alpha Signal', category: 'ai_news' },
  { url: 'https://ainews.sh', name: 'AI News', category: 'ai_news' },
  { url: 'https://www.unwind.ai', name: 'Unwind AI', category: 'ai_news' },
  { url: 'https://echohive.live', name: 'Echohive', category: 'ai_news' },
  { url: 'https://stratechery.com', name: 'Stratechery', category: 'thought_leadership' },
  { url: 'https://lablab.ai/event', name: 'Lablab.ai', category: 'competition' },
];

/** Content sources for thought leadership generation */
const CONTENT_SOURCES: Array<{ url: string; name: string }> = [
  { url: 'https://natesnewsletter.substack.com/', name: 'Nate Jones' },
];

/** Event search queries */
const EVENT_SEARCHES = [
  'AI events Portugal 2026',
  'AI events Switzerland 2026',
  'GenAI conference Europe 2026',
];

/**
 * Scrape a single URL with Firecrawl.
 * Returns LLM-ready markdown content.
 */
async function scrapeUrl(apiKey: string, url: string): Promise<FirecrawlPage | null> {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 30000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl scrape failed for ${url}: ${response.status} ${error.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.success || !data.data) return null;

  return {
    url: data.data.url || url,
    title: data.data.metadata?.title || '',
    markdown: data.data.markdown || '',
    metadata: data.data.metadata || {},
  };
}

/**
 * Search the web via Firecrawl and scrape results.
 */
async function searchAndScrape(
  apiKey: string,
  query: string,
  maxResults = 5
): Promise<FirecrawlPage[]> {
  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      limit: maxResults,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl search failed for "${query}": ${response.status} ${error.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.success || !data.data) return [];

  return (data.data as Array<Record<string, unknown>>).map((item) => ({
    url: String(item.url || ''),
    title: String((item.metadata as Record<string, string>)?.title || item.title || ''),
    markdown: String(item.markdown || ''),
    metadata: (item.metadata as Record<string, string>) || {},
  }));
}

/**
 * Extract news items from a scraped page's markdown.
 * Uses simple heuristics to find headlines and summaries.
 */
function extractNewsFromMarkdown(
  markdown: string,
  sourceName: string,
  sourceUrl: string,
  category: NewsItem['category']
): NewsItem[] {
  const items: NewsItem[] = [];

  // Split by markdown headers (## or ###)
  const sections = markdown.split(/\n(?=#{2,3}\s)/);

  for (const section of sections.slice(0, 10)) { // Max 10 items per source
    const headerMatch = section.match(/^#{2,3}\s+(.+)/);
    if (!headerMatch) continue;

    const title = headerMatch[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    if (title.length < 10 || title.length > 200) continue;

    // Extract first paragraph as summary
    const paragraphs = section.split('\n\n').filter((p) => !p.startsWith('#') && p.trim().length > 20);
    const summary = paragraphs[0]?.trim().slice(0, 500) || '';

    // Try to extract a link
    const linkMatch = section.match(/\[([^\]]*)\]\(([^)]+)\)/);
    const itemUrl = linkMatch?.[2] || sourceUrl;

    items.push({
      title,
      summary,
      url: itemUrl,
      sourceName,
      publishedAt: null, // Would need date parsing per-source
      category,
      location: null,
      eventDate: null,
    });
  }

  return items;
}

/**
 * Extract content source material for thought leadership generation.
 */
function extractContentSource(page: FirecrawlPage, sourceName: string): ContentSource {
  return {
    title: page.title,
    body: page.markdown.slice(0, 5000), // Truncate for Claude context
    url: page.url,
    sourceName,
    publishedAt: page.metadata.publishedTime || page.metadata.date || null,
  };
}

/**
 * Main export: Scrape all intelligence sources.
 * Returns news items + content sources for thought leadership.
 */
export async function scrapeIntelligence(): Promise<FirecrawlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('Missing FIRECRAWL_API_KEY');
  }

  const startTime = Date.now();
  const allNews: NewsItem[] = [];
  const allContent: ContentSource[] = [];
  const errors: string[] = [];

  // ── Scrape news sources (parallel, max 3 concurrent) ──
  const newsChunks: Array<typeof NEWS_SOURCES> = [];
  for (let i = 0; i < NEWS_SOURCES.length; i += 3) {
    newsChunks.push(NEWS_SOURCES.slice(i, i + 3));
  }

  for (const chunk of newsChunks) {
    const results = await Promise.allSettled(
      chunk.map(async (source) => {
        const page = await scrapeUrl(apiKey, source.url);
        if (page) {
          return extractNewsFromMarkdown(page.markdown, source.name, source.url, source.category);
        }
        return [];
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allNews.push(...result.value);
      } else {
        errors.push(result.reason?.message || 'Unknown news scrape error');
      }
    }
  }

  // ── Scrape content sources for thought leadership ──
  for (const source of CONTENT_SOURCES) {
    try {
      const page = await scrapeUrl(apiKey, source.url);
      if (page) {
        allContent.push(extractContentSource(page, source.name));
      }
    } catch (err) {
      errors.push(`Content source ${source.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Search for events ──
  for (const query of EVENT_SEARCHES) {
    try {
      const pages = await searchAndScrape(apiKey, query, 3);
      for (const page of pages) {
        allNews.push({
          title: page.title,
          summary: page.markdown.slice(0, 500),
          url: page.url,
          sourceName: 'Event Search',
          publishedAt: null,
          category: 'event',
          location: query.includes('Portugal') ? 'Portugal' : query.includes('Switzerland') ? 'Switzerland' : 'Europe',
          eventDate: null,
        });
      }
    } catch (err) {
      errors.push(`Event search "${query}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    news: allNews,
    contentSources: allContent,
    durationMs,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}

/**
 * Scrape a company career page to find the direct application URL.
 * Called for high-scoring jobs to avoid applying on LinkedIn.
 */
export async function scrapeCareerPage(companyName: string, jobTitle: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  try {
    const pages = await searchAndScrape(apiKey, `${companyName} careers ${jobTitle} apply`, 3);

    // Look for a careers/jobs page with an apply link
    for (const page of pages) {
      const applyMatch = page.markdown.match(/\[.*(?:apply|submit|application).*\]\(([^)]+)\)/i);
      if (applyMatch) return applyMatch[1];

      // Check if URL itself is a career page
      if (page.url.match(/careers|jobs|apply|workday|greenhouse|lever|ashby/i)) {
        return page.url;
      }
    }
    return pages[0]?.url || null;
  } catch {
    return null;
  }
}


export async function scrapeOgImage(url: string | null): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey || !url || !url.startsWith('http')) return null;
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, timeout: 20000 }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const m = (data?.data?.metadata || {}) as Record<string, unknown>;
    const cand = m.ogImage ?? m['og:image'] ?? m['twitter:image'] ?? m.image ?? m.ogImageUrl;
    const val = Array.isArray(cand) ? cand[0] : cand;
    return typeof val === 'string' && val.startsWith('http') ? val : null;
  } catch { return null; }
}

export type { NewsItem, ContentSource, FirecrawlResult };


/**
 * v3.2.5+ enrichment helpers using the existing scrapeUrl primitive.
 * Budget-aware: every call is capped, errors are caught, callers always continue.
 */

export interface CompanyEnrichment {
  about: string | null;
  url: string | null;
  durationMs: number;
  error: string | null;
}

/** Slugify a company name for best-effort domain guesses. */
function slugifyDomain(company: string): string {
  return company
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 30);
}

/**
 * Scrape a company\'s About page for cover-letter context.
 *
 * v4.3 (May 6 2026): replaced the slug-guesser ({slug}.com/about pattern) with a
 * /v2/search → /v2/scrape flow. The slug guess was failing on names like
 * "Mogi I/O : OTT/Podcast/Short Video Apps for you" (3/3 errors May 6 cron).
 * The search-first pattern was proven manually that night on Everfield, Mindrift,
 * Pricefx — picks the company\'s real domain even with weird names.
 *
 * Cost per call: 2 credits (search) + 1 credit (scrape) = 3 credits.
 * Budget: 3 calls/day × 30 days × 3 credits = 270/month vs 500 free credits.
 *
 * Skips known aggregator/meta domains (LinkedIn, G2, Wikipedia, Eventbrite, …)
 * to avoid scraping a profile page instead of the company\'s own site.
 */
const AGGREGATOR_HOSTS = new Set([
  'linkedin.com', 'www.linkedin.com',
  'g2.com', 'www.g2.com',
  'wikipedia.org', 'en.wikipedia.org',
  'eventbrite.com', 'www.eventbrite.com', 'eventbrite.ie',
  'crunchbase.com', 'www.crunchbase.com',
  'glassdoor.com', 'www.glassdoor.com',
  'youtube.com', 'www.youtube.com',
  'twitter.com', 'x.com', 'www.x.com',
  'facebook.com', 'www.facebook.com',
  'instagram.com', 'www.instagram.com',
  'reddit.com', 'www.reddit.com',
]);

interface FirecrawlSearchHit { url?: string; title?: string }

async function searchCompanyDomain(apiKey: string, company: string): Promise<string | null> {
  const cleaned = company.replace(/[:|·–—].*$/g, '').trim().slice(0, 80); // strip everything after colon/pipe
  const query = `${cleaned} official website company`;
  try {
    const r = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ query, limit: 5 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const hits: FirecrawlSearchHit[] = data?.data?.web ?? [];
    for (const hit of hits) {
      if (!hit.url) continue;
      try {
        const u = new URL(hit.url);
        if (AGGREGATOR_HOSTS.has(u.hostname)) continue;
        return hit.url;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function scrapeCompanyAbout(company: string): Promise<CompanyEnrichment> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { about: null, url: null, durationMs: 0, error: 'FIRECRAWL_API_KEY missing' };
  if (!company) return { about: null, url: null, durationMs: 0, error: 'no company' };

  const start = Date.now();

  // Step 1 — search for the real domain
  const target = await searchCompanyDomain(apiKey, company);
  if (!target) {
    // Fall back to old slug-guesser ONCE in case search is rate-limited
    const slug = slugifyDomain(company);
    if (!slug) return { about: null, url: null, durationMs: Date.now() - start, error: 'no domain found' };
    try {
      const page = await scrapeUrl(apiKey, `https://${slug}.com`);
      if (page && page.markdown.length > 300) {
        return { about: page.markdown.slice(0, 2000), url: `https://${slug}.com`, durationMs: Date.now() - start, error: null };
      }
    } catch { /* fall through */ }
    return { about: null, url: null, durationMs: Date.now() - start, error: 'search returned no usable domain' };
  }

  // Step 2 — scrape the chosen URL
  try {
    const page = await scrapeUrl(apiKey, target);
    if (page && page.markdown.length > 300) {
      return { about: page.markdown.slice(0, 2000), url: target, durationMs: Date.now() - start, error: null };
    }
    return { about: null, url: target, durationMs: Date.now() - start, error: 'scraped content too short' };
  } catch (err) {
    return { about: null, url: target, durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface EventEnrichment {
  details: string | null;
  durationMs: number;
  error: string | null;
}

/**
 * Scrape an event landing page for date/speaker/registration enrichment.
 * Returns trimmed markdown the cron can attach to a triage_items row.
 */
export async function scrapeEventDetails(eventUrl: string): Promise<EventEnrichment> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { details: null, durationMs: 0, error: 'FIRECRAWL_API_KEY missing' };
  if (!eventUrl || !eventUrl.startsWith('http')) return { details: null, durationMs: 0, error: 'invalid url' };

  const start = Date.now();
  try {
    const page = await scrapeUrl(apiKey, eventUrl);
    if (!page) return { details: null, durationMs: Date.now() - start, error: 'no page' };
    return {
      details: page.markdown.slice(0, 1500),
      durationMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    return { details: null, durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}
