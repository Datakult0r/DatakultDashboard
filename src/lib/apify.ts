/**
 * Apify integration for job discovery.
 * Uses LinkedIn Jobs Scraper and All Job Scraper actors to find GenAI remote roles.
 * NO LinkedIn login required — scrapes public job listings only.
 * Zero risk to Philippe's LinkedIn account.
 */

interface ApifyJobResult {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  applyUrl: string | null;
  description: string;
  postedAt: string;
  salary: string | null;
  jobType: string | null;
  easyApply: boolean;
  source: 'linkedin' | 'indeed' | 'remoteok' | 'glassdoor';
}

interface ApifyRunResult {
  items: ApifyJobResult[];
  source: string;
  durationMs: number;
  error: string | null;
}

/** Search queries targeting Philippe's ideal roles */
const SEARCH_QUERIES = [
  'generative AI remote',
  'AI strategy architect remote',
  'head of AI remote',
  'GenAI engineer contract remote',
  'agentic AI remote',
];

/** Locations to search */
const SEARCH_LOCATIONS = ['Europe', 'Remote'];

/**
 * Run an Apify actor and wait for results.
 * Uses the synchronous run endpoint (waits up to 120s).
 */
async function runActor(
  apiToken: string,
  actorId: string,
  input: Record<string, unknown>,
  timeoutSecs = 120
): Promise<Record<string, unknown>[]> {
  // Start the actor run
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiToken}&timeout=${timeoutSecs}`;

  const response = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apify actor ${actorId} failed: ${response.status} ${error.slice(0, 500)}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Normalize LinkedIn Jobs Scraper output to our standard format.
 * Actor: apify/linkedin-jobs-scraper (or similar public actor)
 */
function normalizeLinkedInJob(raw: Record<string, unknown>): ApifyJobResult {
  return {
    title: String(raw.title || raw.jobTitle || ''),
    company: String(raw.company || raw.companyName || ''),
    location: String(raw.location || raw.jobLocation || ''),
    jobUrl: String(raw.url || raw.jobUrl || raw.link || ''),
    applyUrl: raw.applyUrl ? String(raw.applyUrl) : null,
    description: String(raw.description || raw.descriptionText || '').slice(0, 3000),
    postedAt: String(raw.postedAt || raw.publishedAt || raw.listedAt || ''),
    salary: raw.salary ? String(raw.salary) : (raw.salaryRange ? String(raw.salaryRange) : null),
    jobType: raw.jobType ? String(raw.jobType) : (raw.employmentType ? String(raw.employmentType) : null),
    easyApply: Boolean(raw.easyApply || raw.isEasyApply || false),
    source: 'linkedin' as const,
  };
}

/**
 * Normalize general job scraper output (Indeed, RemoteOK, Glassdoor).
 */
function normalizeGeneralJob(raw: Record<string, unknown>, source: 'indeed' | 'remoteok' | 'glassdoor'): ApifyJobResult {
  return {
    title: String(raw.title || raw.jobTitle || raw.positionName || ''),
    company: String(raw.company || raw.companyName || raw.employer || ''),
    location: String(raw.location || raw.jobLocation || ''),
    jobUrl: String(raw.url || raw.jobUrl || raw.link || ''),
    applyUrl: raw.applyUrl ? String(raw.applyUrl) : null,
    description: String(raw.description || raw.jobDescription || '').slice(0, 3000),
    postedAt: String(raw.postedAt || raw.datePosted || ''),
    salary: raw.salary ? String(raw.salary) : null,
    jobType: raw.jobType ? String(raw.jobType) : null,
    easyApply: false,
    source,
  };
}

/**
 * Deduplicate jobs by URL and title+company combo.
 */
function deduplicateJobs(jobs: ApifyJobResult[]): ApifyJobResult[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const urlKey = job.jobUrl.toLowerCase().replace(/[?#].*$/, '');
    const titleKey = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (seen.has(urlKey) || seen.has(titleKey)) return false;
    if (urlKey) seen.add(urlKey);
    seen.add(titleKey);
    return true;
  });
}

/**
 * Main export: Discover GenAI remote jobs via Apify.
 * Runs LinkedIn Jobs Scraper as primary, general scraper as secondary.
 * Returns deduplicated, normalized results.
 */
export async function discoverJobs(): Promise<ApifyRunResult> {
  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) {
    throw new Error('Missing APIFY_API_TOKEN');
  }

  const startTime = Date.now();
  const allJobs: ApifyJobResult[] = [];
  const errors: string[] = [];

  // ── LinkedIn Jobs Scraper ──
  // The actor curious_coder/linkedin-jobs-scraper now requires `urls` (search URLs),
  // not `queries`. Build LinkedIn search URLs from our query × location matrix.
  try {
    const urls: string[] = [];
    for (const q of SEARCH_QUERIES.slice(0, 3)) {
      for (const loc of SEARCH_LOCATIONS) {
        const params = new URLSearchParams({
          keywords: q,
          location: loc,
          f_TPR: 'r604800',     // posted in last 7 days
          f_WT: '2',            // remote
          sortBy: 'DD',         // by date desc
        });
        urls.push(`https://www.linkedin.com/jobs/search/?${params.toString()}`);
      }
    }
    const linkedInResults = await runActor(
      apiToken,
      'curious_coder~linkedin-jobs-scraper',
      {
        urls: urls.slice(0, 6),
        count: 30,
        scrapeCompany: false,
      },
      90,
    );

    for (const raw of linkedInResults) {
      allJobs.push(normalizeLinkedInJob(raw));
    }
  } catch (err) {
    errors.push(`LinkedIn scraper: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── General Job Scraper (Indeed) ──
  // misceres/indeed-scraper expects { country, position, location, maxItems }.
  // The previous {queries, locations, sortBy} input shape was wrong and the actor
  // run failed. Switch to a single call per query to stay within actor limits.
  try {
    for (const q of SEARCH_QUERIES.slice(0, 2)) {
      const generalResults = await runActor(
        apiToken,
        'misceres~indeed-scraper',
        {
          country: 'US',
          position: q,
          location: 'Remote',
          maxItems: 10,
        },
        45,
      );
      for (const raw of generalResults) {
        allJobs.push(normalizeGeneralJob(raw, 'indeed'));
      }
    }
  } catch (err) {
    errors.push(`Indeed scraper: ${err instanceof Error ? err.message : String(err)}`);
  }

  const deduplicated = deduplicateJobs(allJobs);
  const durationMs = Date.now() - startTime;

  return {
    items: deduplicated,
    source: 'apify',
    durationMs,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}

export type { ApifyJobResult, ApifyRunResult };
