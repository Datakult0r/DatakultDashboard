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
  companyCareerUrl?: string | null;
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

/** Structured output every apply session must return (enforced via outputSchema). */
const APPLY_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    submitted: { type: 'boolean' },
    reason: { type: 'string' },
    unanswered_questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['submitted', 'reason'],
} as const;

export interface SessionVerification {
  sessionId: string;
  /** Browser Use session status */
  status: string;
  /** Did the agent CONFIRM the application was submitted? */
  submitted: boolean;
  /** Agent-reported detail (failure reason / unanswered questions) */
  detail: string;
  /** Session reached a terminal state */
  done: boolean;
}

/**
 * Poll a session for completion + verified outcome.
 * An application may only be recorded as applied when submitted === true.
 */
export async function getSessionVerification(sessionId: string): Promise<SessionVerification> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  const out: SessionVerification = { sessionId, status: 'unknown', submitted: false, detail: '', done: false };
  if (!apiKey || !sessionId) return out;
  try {
    const r = await fetch(`${BU_BASE}/sessions/${sessionId}`, { headers: { [BU_HEADER]: apiKey } });
    if (!r.ok) return { ...out, detail: `API ${r.status}` };
    const data = await r.json();
    out.status = String(data.status ?? 'unknown');
    out.done = ['stopped', 'timed_out', 'error', 'idle'].includes(out.status);
    let output: Record<string, unknown> = {};
    try {
      output = typeof data.output === 'string' ? JSON.parse(data.output) : (data.output ?? {});
    } catch {
      out.detail = typeof data.output === 'string' ? data.output.slice(0, 300) : '';
    }
    out.submitted = Boolean(output.submitted) && Boolean(data.isTaskSuccessful ?? true);
    const unanswered = Array.isArray(output.unanswered_questions) ? output.unanswered_questions.join('; ') : '';
    out.detail = [output.reason, unanswered ? `unanswered: ${unanswered}` : null].filter(Boolean).join(' — ') || out.detail;
    return out;
  } catch (err) {
    return { ...out, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Stop a session (flushes profile cookies on clean exit). */
export async function stopSession(sessionId: string): Promise<boolean> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey || !sessionId) return false;
  try {
    const r = await fetch(`${BU_BASE}/sessions/${sessionId}/stop`, { method: 'POST', headers: { [BU_HEADER]: apiKey } });
    return r.ok;
  } catch {
    return false;
  }
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
  const profileId = process.env.BROWSER_USE_PROFILE_ID;
  if (!profileId) {
    // HARD GUARD: without a persistent logged-in profile the cloud browser is
    // NOT logged in to LinkedIn. Running anyway would hit a login wall (or
    // worse, look like an account-takeover attempt). Refuse.
    return {
      taskId: '',
      status: 'failed',
      message: 'BROWSER_USE_PROFILE_ID not set — create a profile at cloud.browser-use.com, log in to LinkedIn in it once, set the env var. Easy Apply refuses to run without it (account safety).',
      jobUrl: task.jobUrl,
    };
  }

  const instructions = [
    'If at ANY point you see a login page, captcha, or security checkpoint: DO NOT log in or solve it. Finish immediately with submitted=false, reason="logged_out".',
    `Navigate to ${task.jobUrl}`,
    'ACT LIKE A HUMAN throughout, never like a script: vary your pace, pause 2-6 seconds between actions, read before you click, scroll the page in small increments (not one jump), and move the mouse naturally. Never fill or submit faster than a person reasonably could.',
    'Read the job description: scroll down slowly over 4-8 seconds taking it in, then scroll back up.',
    'Click the "Easy Apply" button. If there is none, finish with submitted=false, reason="no_easy_apply_button".',
    'Wait for the application form to load.',
    'Keep any values LinkedIn pre-filled. For empty required fields use: Name "Philippe Küng", Email "philippe.kung@clinicofai.com", Location "Lisbon, Portugal"' + (process.env.PHILIPPE_PHONE ? `, Phone "${process.env.PHILIPPE_PHONE}"` : '') + '.',
    task.coverLetter ? `Cover letter: ${task.coverLetter.slice(0, 800)}` : '',
    'If a REQUIRED question cannot be answered from the values above (salary, visa specifics, niche skill years): DO NOT GUESS — discard the application and finish with submitted=false, reason="needs_human", listing the questions in unanswered_questions.',
    'Before the final submit, pause ~3-5 seconds to "review" as a human would, then submit and wait for the "application sent" confirmation, and finish with submitted=true.',
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
        profileId,
        proxyCountryCode: 'pt',
        maxCostUsd: Number(process.env.BROWSER_USE_MAX_COST_USD || 1.5),
        outputSchema: APPLY_OUTPUT_SCHEMA,
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
  const career = (task.companyCareerUrl || '').trim();
  const careerIsUsable = career && !/linkedin\.com/i.test(career);
  const navLine = careerIsUsable
    ? `Go directly to the company's application page: ${career}`
    : `This role (${task.jobTitle} at ${task.company}) was found on a LinkedIn posting (${task.jobUrl}). DO NOT apply on LinkedIn and DO NOT log into LinkedIn — LinkedIn always demands a login and that is not the goal. Instead, open ${task.company}'s OWN official careers/jobs website (use a web search for "${task.company} careers ${task.jobTitle}" if you don't know the URL), find this role or the closest matching open role, and open its application form on the company's own domain.`;
  const instructions = [
    navLine,
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
    process.env.CV_PUBLIC_URL
      ? `If a CV / resume upload is required, the CV file is available at: ${process.env.CV_PUBLIC_URL} — download it and upload it to the form.`
      : 'If a CV / resume upload is REQUIRED and cannot be skipped, finish with submitted=false, reason="needs_cv_upload" — do not submit incomplete.',
    'If the form requires creating an account or logging in: finish with submitted=false, reason="needs_account". Never create accounts or log in.',
    'Do NOT invent answers to questions you cannot map to the values above. If a required question is unanswerable, finish with submitted=false, reason="needs_human", listing the fields in unanswered_questions.',
    'ACT LIKE A HUMAN: vary pace, pause 2-5s between steps, scroll in small increments, never fill faster than a person could.',
    'Fill EVERY field you can from the values above, then SUBMIT the application. Wait for the confirmation ("application received" / "thank you for applying") and finish with submitted=true. Only stop WITHOUT submitting if you hit one of the refusal conditions above (account/login required, required CV upload unavailable, or an unanswerable required question) — otherwise complete and submit.',
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
        // Company sites carry no LinkedIn ban risk — use the cheap model when configured.
        model: process.env.BROWSER_USE_WEBSITE_MODEL || undefined,
        profileId: process.env.BROWSER_USE_PROFILE_ID || undefined,
        proxyCountryCode: 'pt',
        maxCostUsd: Number(process.env.BROWSER_USE_WEBSITE_MAX_COST_USD || 3),
        outputSchema: APPLY_OUTPUT_SCHEMA,
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
