/**
 * SwissDevJobs — Switzerland tech jobs with salary info. Free public RSS feed
 * (https://swissdevjobs.ch/rss, ~220 items). No API key. DACH-relevant source.
 *
 * Each RSS <item> title looks like: "Role @ Company [CHF 85'000 - 110'000]".
 * We keep only AI/GenAI/ML roles and shape them into the shared ApifyJobResult
 * contract so the existing scoring pipeline (remote/DACH/GenAI weighting) picks them up.
 */

import type { ApifyJobResult } from './apify';

interface SwissDevResult {
  items: ApifyJobResult[];
  durationMs: number;
  error: string | null;
}

const RSS_URL = 'https://swissdevjobs.ch/rss';

// Keep only AI / GenAI / ML roles (the scorer then handles remote/DACH/comp weighting).
const AI_KEYWORDS = [
  'ai engineer', 'ai architect', 'genai', 'gen ai', 'generative', 'llm', 'machine learning',
  'ml engineer', 'mlops', 'artificial intelligence', 'nlp', 'data scientist',
  'deep learning', 'agentic', 'prompt', 'computer vision',
];

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]).trim() : '';
}

/** Parse "Role @ Company [CHF 85'000 - 110'000]" → {title, company, salary}. */
function parseTitle(raw: string): { title: string; company: string; salary: string | null } {
  let salary: string | null = null;
  const sal = raw.match(/\[([^\]]+)\]\s*$/);
  let rest = raw;
  if (sal) { salary = sal[1].trim(); rest = raw.slice(0, sal.index).trim(); }
  const at = rest.lastIndexOf('@');
  if (at === -1) return { title: rest.trim(), company: '', salary };
  return { title: rest.slice(0, at).trim(), company: rest.slice(at + 1).trim(), salary };
}

export async function discoverJobsSwissDevJobs(): Promise<SwissDevResult> {
  const start = Date.now();
  try {
    const r = await fetch(RSS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ControlTower/1.0)' } });
    if (!r.ok) return { items: [], durationMs: Date.now() - start, error: `RSS ${r.status}` };
    const xml = await r.text();
    const blocks = xml.split('<item>').slice(1).map((b) => b.split('</item>')[0]);
    const out: ApifyJobResult[] = [];
    const seen = new Set<string>();
    for (const b of blocks) {
      const rawTitle = tag(b, 'title');
      const link = tag(b, 'link').replace(/[?#].*$/, '');
      const descHtml = tag(b, 'description');
      if (!rawTitle || !link) continue;
      const hay = `${rawTitle} ${descHtml}`.toLowerCase();
      if (!AI_KEYWORDS.some((k) => hay.includes(k))) continue;
      if (seen.has(link)) continue;
      seen.add(link);
      const { title, company, salary } = parseTitle(rawTitle);
      const description = descHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
      out.push({
        title,
        company: company || 'SwissDevJobs listing',
        location: 'Switzerland',
        jobUrl: link,
        applyUrl: link,
        description,
        postedAt: tag(b, 'pubDate'),
        salary,
        jobType: null,
        easyApply: false,
        source: 'swissdevjobs',
      });
      if (out.length >= 25) break;
    }
    return { items: out, durationMs: Date.now() - start, error: null };
  } catch (err) {
    return { items: [], durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}
