/**
 * RemoteOK — free public JSON feed of remote tech jobs (no API key, no Apify).
 * Fetches https://remoteok.com/api?tag=ai (and/or tag=ml) and shapes results into the
 * shared ApifyJobResult contract so the existing scoring pipeline picks them up.
 *
 * Reference: https://remoteok.com/api  (the first element of the array is metadata)
 */

import type { ApifyJobResult } from './apify';

interface RemoteOKEntry {
  id?: string | number;
  slug?: string;
  position?: string;
  company?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  description?: string;
  date?: string;
  salary_min?: number;
  salary_max?: number;
  tags?: string[];
}

interface RemoteOKResult {
  items: ApifyJobResult[];
  durationMs: number;
  error: string | null;
}

const TAGS = ['ai', 'ml', 'genai', 'llm'];

function toJob(entry: RemoteOKEntry): ApifyJobResult | null {
  if (!entry?.position || !entry?.company || !entry?.url) return null;
  const salary =
    entry.salary_min && entry.salary_max
      ? `$${entry.salary_min.toLocaleString()} - $${entry.salary_max.toLocaleString()}`
      : null;
  return {
    title: entry.position,
    company: entry.company,
    location: entry.location || 'Remote',
    jobUrl: entry.url,
    applyUrl: entry.apply_url || entry.url,
    description: (entry.description ?? '').replace(/<[^>]+>/g, '').slice(0, 4000),
    postedAt: entry.date ?? '',
    salary,
    jobType: null,
    easyApply: false,
    source: 'remoteok',
  };
}

/**
 * Fetch GenAI/AI/ML remote jobs from RemoteOK.
 * Returns up to ~25 jobs (deduped by URL) so the Claude scoring batch stays cheap.
 */
export async function discoverJobsRemoteOK(): Promise<RemoteOKResult> {
  const start = Date.now();
  const items: ApifyJobResult[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const tag of TAGS) {
    try {
      const res = await fetch(`https://remoteok.com/api?tag=${encodeURIComponent(tag)}`, {
        headers: {
          // Some endpoints reject empty UA — set a real one.
          'User-Agent': 'DatakultDashboard/3.2 (+https://datakult-dashboard.vercel.app)',
          'Accept': 'application/json',
        },
        // 15s feels generous for a JSON endpoint
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        errors.push(`RemoteOK ${tag}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as RemoteOKEntry[];
      // First entry is { legal: ... } metadata
      const records = Array.isArray(data) ? data.slice(1) : [];
      for (const raw of records.slice(0, 50)) {
        const job = toJob(raw);
        if (!job) continue;
        if (seen.has(job.jobUrl)) continue;
        seen.add(job.jobUrl);
        items.push(job);
        if (items.length >= 25) break;
      }
      if (items.length >= 25) break;
    } catch (err) {
      errors.push(`RemoteOK ${tag}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    items,
    durationMs: Date.now() - start,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}

export type { RemoteOKResult };
