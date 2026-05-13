/**
 * Browser Use Cloud integration for LinkedIn Easy Apply.
 *
 * API contract (verified May 2026):
 *   - Base URL: https://api.browser-use.com/api/v3
 *   - Auth header: X-Browser-Use-API-Key  (NOT Authorization: Bearer)
 *   - Create task: POST /api/v3/sessions  body: { task, model? }
 *   - List sessions: GET /api/v3/sessions?limit=N
 *
 * SAFETY:
 *   - Only triggers after Philippe approves from the dashboard
 *   - Max 5 applications per session, 30-90s randomized waits between
 *   - Browser Use's models add their own anti-detection
 */

const BU_BASE = 'https://api.browser-use.com/api/v3';
const BU_HEADER = 'X-Browser-Use-API-Key';

export interface BrowserUseTask {
  jobUrl: string;
  jobTitle: string;
  company: string;
  coverLetter: string | null;
}

export interface BrowserUseResult {
  taskId: string;
  status: 'completed' | 'failed' | 'no_credits' | 'queued' | 'unauthorized';
  message: string;
  jobUrl: string;
}

export interface EasyApplyResult {
  results: BrowserUseResult[];
  durationMs: number;
  error: string | null;
  authOk: boolean;
}

/** Verify the API key works. Cheap GET — returns true on 2xx. */
export async function verifyAuth(apiKey: string): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const r = await fetch(`${BU_BASE}/sessions?limit=1`, {
      headers: { [BU_HEADER]: apiKey },
    });
    if (r.ok) return { ok: true, status: r.status };
    const detail = (await r.text()).slice(0, 200);
    return { ok: false, status: r.status, detail };
  } catch (err) {
    return { ok: false, status: 0, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Submit one Easy Apply task. POST /api/v3/sessions. */
async function submitEasyApply(apiKey: string, task: BrowserUseTask): Promise<BrowserUseResult> {
  const instructions = [
    `Navigate to ${task.jobUrl}`,
    'Wait 2-4 seconds (randomized).',
    'Click the "Easy Apply" button.',
    'Wait for the application form to load.',
    'Fill in fields with: Name "Philippe Küng", Email "philippe.kung@clinicofai.com", Location "Lisbon, Portugal".',
    task.coverLetter ? `Cover letter: ${task.coverLetter.slice(0, 800)}` : '',
    'Submit and wait for confirmation. If a multi-step form, fill what you can; do not invent answers.',
    'On success, return the confirmation message verbatim.',
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch(`${BU_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [BU_HEADER]: apiKey,
      },
      body: JSON.stringify({
        task: instructions,
        title: `Easy Apply · ${task.company}`,
      }),
    });

    if (r.status === 401 || r.status === 403) {
      return { taskId: '', status: 'unauthorized', message: 'Browser Use API key rejected', jobUrl: task.jobUrl };
    }
    if (r.status === 402 || r.status === 429) {
      const detail = (await r.text()).slice(0, 200);
      return { taskId: '', status: 'no_credits', message: `Browser Use throttled / out of credits: ${detail}`, jobUrl: task.jobUrl };
    }
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return { taskId: '', status: 'failed', message: `${r.status}: ${detail}`, jobUrl: task.jobUrl };
    }
    const data = await r.json();
    return {
      taskId: String(data.id ?? data.session_id ?? ''),
      status: 'queued',
      message: `Easy Apply queued for ${task.company} — ${task.jobTitle}`,
      jobUrl: task.jobUrl,
    };
  } catch (err) {
    return { taskId: '', status: 'failed', message: err instanceof Error ? err.message : String(err), jobUrl: task.jobUrl };
  }
}

/**
 * Execute Easy Apply for approved jobs. Called by /api/actions/apply after approval.
 * Verifies auth once up-front, then submits up to 5 tasks with randomized waits.
 */
export async function executeEasyApply(tasks: BrowserUseTask[]): Promise<EasyApplyResult> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return {
      results: tasks.map((t) => ({
        taskId: '', status: 'unauthorized' as const,
        message: 'BROWSER_USE_API_KEY not configured', jobUrl: t.jobUrl,
      })),
      durationMs: 0,
      error: 'BROWSER_USE_API_KEY not set',
      authOk: false,
    };
  }

  const startTime = Date.now();
  const auth = await verifyAuth(apiKey);
  if (!auth.ok) {
    return {
      results: tasks.map((t) => ({
        taskId: '', status: 'unauthorized' as const,
        message: `Browser Use auth failed (${auth.status}): ${auth.detail ?? ''}`,
        jobUrl: t.jobUrl,
      })),
      durationMs: Date.now() - startTime,
      error: `Auth ${auth.status}: ${auth.detail ?? ''}`,
      authOk: false,
    };
  }

  const limited = tasks.slice(0, 5);
  const results: BrowserUseResult[] = [];
  for (let i = 0; i < limited.length; i++) {
    results.push(await submitEasyApply(apiKey, limited[i]));
    if (i < limited.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 30000 + Math.random() * 60000));
    }
  }

  return {
    results,
    durationMs: Date.now() - startTime,
    error: null,
    authOk: true,
  };
}

/**
 * Submit one website (non-LinkedIn-EasyApply) job application via Browser Use.
 * Used for jobs where the apply flow is the company's own ATS form (Greenhouse, Lever, Workday, custom).
 * Instructions are deliberately generic — no "Click Easy Apply" assumption.
 */
async function submitWebsiteApply(apiKey: string, task: BrowserUseTask): Promise<BrowserUseResult> {
  const instructions = [
    `Navigate to ${task.jobUrl}`,
    'Wait 2-4 seconds (randomized).',
    'Find and click the apply button (commonly labeled "Apply", "Apply Now", "Apply for this job", or similar).',
    'If the application opens in a new tab, switch to it.',
    'Wait for the application form to load.',
    'Fill in standard fields with these values:',
    '  Full Name: Philippe Küng',
    '  First Name: Philippe',
    '  Last Name: Küng',
    '  Email: philippe.kung@clinicofai.com',
    '  Phone: +351 933 607 511',
    '  Location: Lisbon, Portugal',
    '  LinkedIn: https://www.linkedin.com/in/pkfde',
    '  Website: https://www.clinicofai.com',
    '  Work Authorization: EU citizen (Swiss/German passports), no visa needed for EU',
    '  Years of AI/ML experience: 6+ total, 5+ GenAI/LLMs',
    '  Salary expectation: EUR 90-130k FTE / EUR 80-150/hr contract',
    '  Notice period / Availability: Immediate (within 1 week)',
    '  Timezone: UTC+1 Lisbon, flexible ±3 hours',
    '  Remote: Yes',
    task.coverLetter ? `If asked for cover letter / "Why are you a good fit": ${task.coverLetter.slice(0, 1200)}` : '',
    'If a CV / resume upload is required, look for an existing uploaded resume on the page (LinkedIn auto-fill, prior session). If not available, SKIP this job — do not submit incomplete.',
    'Do NOT invent answers to questions you cannot map to the values above. If a required question is unanswerable, SKIP and return "skipped_required_field" with the field name.',
    'Submit only when all required fields are filled. Return the confirmation message verbatim.',
  ].filter(Boolean).join('\n');

  try {
    const r = await fetch(`${BU_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [BU_HEADER]: apiKey,
      },
      body: JSON.stringify({
        task: instructions,
        title: `Website Apply · ${task.company}`,
      }),
    });

    if (r.status === 401 || r.status === 403) {
      return { taskId: '', status: 'unauthorized', message: 'Browser Use API key rejected', jobUrl: task.jobUrl };
    }
    if (r.status === 402 || r.status === 429) {
      const detail = (await r.text()).slice(0, 200);
      return { taskId: '', status: 'no_credits', message: `Browser Use throttled / out of credits: ${detail}`, jobUrl: task.jobUrl };
    }
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return { taskId: '', status: 'failed', message: `${r.status}: ${detail}`, jobUrl: task.jobUrl };
    }
    const data = await r.json();
    return {
      taskId: String(data.id ?? data.session_id ?? ''),
      status: 'queued',
      message: `Website Apply queued for ${task.company} — ${task.jobTitle}`,
      jobUrl: task.jobUrl,
    };
  } catch (err) {
    return { taskId: '', status: 'failed', message: err instanceof Error ? err.message : String(err), jobUrl: task.jobUrl };
  }
}

/**
 * Execute Website Apply for approved jobs. Same anti-detection envelope as Easy Apply
 * (verify auth once, cap at 5, 30-90s randomized waits) but generic instructions.
 */
export async function executeWebsiteApply(tasks: BrowserUseTask[]): Promise<EasyApplyResult> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return {
      results: tasks.map((t) => ({
        taskId: '', status: 'unauthorized' as const,
        message: 'BROWSER_USE_API_KEY not configured', jobUrl: t.jobUrl,
      })),
      durationMs: 0,
      error: 'BROWSER_USE_API_KEY not set',
      authOk: false,
    };
  }

  const startTime = Date.now();
  const auth = await verifyAuth(apiKey);
  if (!auth.ok) {
    return {
      results: tasks.map((t) => ({
        taskId: '', status: 'unauthorized' as const,
        message: `Browser Use auth failed (${auth.status}): ${auth.detail ?? ''}`,
        jobUrl: t.jobUrl,
      })),
      durationMs: Date.now() - startTime,
      error: `Auth ${auth.status}: ${auth.detail ?? ''}`,
      authOk: false,
    };
  }

  const limited = tasks.slice(0, 5);
  const results: BrowserUseResult[] = [];
  for (let i = 0; i < limited.length; i++) {
    results.push(await submitWebsiteApply(apiKey, limited[i]));
    if (i < limited.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 30000 + Math.random() * 60000));
    }
  }

  return {
    results,
    durationMs: Date.now() - startTime,
    error: null,
    authOk: true,
  };
}
