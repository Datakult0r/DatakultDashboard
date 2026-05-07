/**
 * Arbeit.Swiss / Job-Room.ch scraper via Apify.
 *
 * Actor: santamaria-automations/arbeit-swiss-scraper (c4m08XqNeLuNBJ1Tm)
 * Source: Switzerland's official government employment service (RAV listings).
 *
 * Why this source: every Swiss employer above a headcount threshold is
 * required to post here BEFORE listing externally. Catches roles that never
 * make it to LinkedIn. Authoritative for the Swiss market.
 *
 * Pricing: $0.00005 per actor start + $0.003 per result.
 *   3 queries × 15 results = 45 results × $0.003 = $0.135/day = ~$4/month.
 *
 * Input shape is best-effort based on the actor's README — adjust if the
 * actor returns a 400 schema-mismatch error.
 */

import type { ApifyJobResult } from './apify';

const ACTOR_ID = 'santamaria-automations~arbeit-swiss-scraper';

interface ArbeitSwissResult {
  items: ApifyJobResult[];
  durationMs: number;
  error: string | null;
}

interface ActorInput {
  queries: string[];
  cantons?: string[];
  sortBy?: 'newest' | 'oldest';
  maxResultsPerQuery?: number;
  totalMaxResults?: number;
  deduplicate?: boolean;
  proxyConfiguration?: {
    useApifyProxy: boolean;
    apifyProxyGroups?: string[];
  };
}

/** Search queries targeting Philippe's Swiss-market profile. */
const SEARCH_QUERIES = [
  'Generative AI',
  'Head of AI',
  'AI Architect',
];

interface RawJob {
  title?: string;
  jobTitle?: string;
  employer?: string;
  company?: string;
  location?: string;
  city?: string;
  canton?: string;
  url?: string;
  jobUrl?: string;
  applicationUrl?: string;
  applyUrl?: string;
  description?: string;
  descriptionFull?: string;
  descriptionSnippet?: string;
  postedAt?: string;
  postedDate?: string;
  publicationDate?: string;
  workloadMin?: number;
  workloadMax?: number;
  employmentType?: string;
  remote?: boolean;
  isRemote?: boolean;
}

function shapeJob(raw: RawJob): ApifyJobResult | null {
  const title = raw.title ?? raw.jobTitle;
  const company = raw.employer ?? raw.company;
  const url = raw.url ?? raw.jobUrl;
  if (!title || !company || !url) return null;

  const locationParts = [raw.city, raw.canton, 'Switzerland'].filter(Boolean);
  const location = raw.location || locationParts.join(', ');
  const description = raw.descriptionFull || raw.description || raw.descriptionSnippet || '';
  const workload =
    raw.workloadMin && raw.workloadMax
      ? `${raw.workloadMin}-${raw.workloadMax}%`
      : raw.workloadMin
        ? `${raw.workloadMin}%`
        : null;

  return {
    title,
    company,
    location: (raw.isRemote || raw.remote) ? `${location} · Remote-flex` : location,
    jobUrl: url,
    applyUrl: raw.applicationUrl ?? raw.applyUrl ?? url,
    description: description.slice(0, 4000),
    postedAt: raw.postedAt ?? raw.postedDate ?? raw.publicationDate ?? '',
    salary: null,
    jobType: workload ?? raw.employmentType ?? null,
    easyApply: false,
    source: 'arbeit_swiss',
  } as ApifyJobResult;
}

export async function discoverJobsArbeitSwiss(): Promise<ArbeitSwissResult> {
  const apiToken = process.env.APIFY_API_TOKEN;
  const start = Date.now();
  if (!apiToken) {
    return { items: [], durationMs: 0, error: 'APIFY_API_TOKEN missing' };
  }

  const input: ActorInput = {
    queries: SEARCH_QUERIES,
    sortBy: 'newest',
    maxResultsPerQuery: 15,
    totalMaxResults: 45,
    deduplicate: true,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
    },
  };

  try {
    const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apiToken}&timeout=180`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(195_000),
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 500);
      return { items: [], durationMs: Date.now() - start, error: `Arbeit.Swiss ${r.status}: ${detail}` };
    }

    const data = (await r.json()) as RawJob[];
    const items: ApifyJobResult[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(data) ? data : []) {
      const job = shapeJob(raw);
      if (!job) continue;
      if (seen.has(job.jobUrl)) continue;
      seen.add(job.jobUrl);
      items.push(job);
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

export type { ArbeitSwissResult };
