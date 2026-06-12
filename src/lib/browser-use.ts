/**
 * Browser Use Cloud v3 integration for LinkedIn Easy Apply.
 *
 * MIGRATION NOTE (June 2026): the previous v1 API (api/v1/run-task, api/v1/credits)
 * was removed by Browser Use — those endpoints now return 404. This module uses the
 * current v3 API:
 *   - POST /api/v3/sessions        create an agent task (async, runs in the cloud)
 *   - GET  /api/v3/sessions/{id}   poll status + structured output
 *   - POST /api/v3/sessions/{id}/stop
 *   - GET  /api/v3/billing/account credit/billing check (replaces /credits)
 * Auth header is `X-Browser-Use-API-Key` (keys start with `bu_`).
 *
 * SAFETY MODEL — Philippe's LinkedIn account is his primary professional asset:
 *   1. PERSISTENT PROFILE: every session loads BROWSER_USE_PROFILE_ID, a profile that
 *      stays logged in to LinkedIn. One login, reused forever. Repeated fresh logins
 *      are the #1 restriction trigger. Create it once at cloud.browser-use.com.
 *   2. STABLE GEO: proxyCountryCode pinned to 'pt' (Lisbon) — IP-hopping looks like
 *      account takeover.
 *   3. PACING lives in /api/actions/execute (daily cap, jittered windows, weekday
 *      bias). This module never sleeps in-process: sessions run async in the cloud
 *      and are finalized by the next cron tick.
 *   4. HONESTY: a session is only marked applied after polling confirms
 *      `submitted: true` in the structured output. Queued ≠ applied.
 *   5. ABORT-DON'T-GUESS: the agent is instructed to abort (not hallucinate answers)
 *      when a form asks something it cannot answer from the provided facts.
 */

const BASE_URL = 'https://api.browser-use.com/api/v3';

interface BrowserUseTask {
  jobUrl: string;
  jobTitle: string;
  company: string;
  coverLetter: string | null;
}

/** Structured output the agent must return (enforced via outputSchema) */
interface EasyApplyOutput {
  submitted: boolean;
  reason: string;
  unanswered_questions: string[];
}

interface SessionCreateResult {
  sessionId: string;
  liveUrl: string | null;
  status: 'queued' | 'failed' | 'no_credits' | 'not_configured';
  message: string;
}

interface SessionStatusResult {
  sessionId: string;
  /** Browser Use session status */
  status: 'created' | 'idle' | 'running' | 'stopped' | 'timed_out' | 'error' | 'unknown';
  /** Did the agent confirm the application was submitted? */
  submitted: boolean;
  /** Agent-reported detail (why it failed / what it couldn't answer) */
  detail: string;
  /** True if the session is finished (success or failure) */
  done: boolean;
  costUsd: number | null;
}

function apiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Browser-Use-API-Key': apiKey,
  };
}

/** Check billing/credits. Returns true when the account can run sessions. */
export async function checkCredits(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/billing/account`, {
      headers: apiHeaders(apiKey),
    });
    if (!response.ok) return false;
    const data = await response.json();
    // v3 billing payload: be permissive about field names
    const balance = data.creditBalanceUsd ?? data.balanceUsd ?? data.credits ?? data.remainingCredits;
    if (balance === undefined || balance === null) return true; // unknown shape — let the session call fail loudly instead
    return Number(balance) > 0;
  } catch {
    return false;
  }
}

/** Facts the agent may use to fill forms. NEVER let it invent answers. */
function applicantFacts(): string {
  const phone = process.env.PHILIPPE_PHONE || '';
  return `
APPLICANT FACTS (use ONLY these — do not invent anything):
- Name: Philippe Küng
- Email: philippe.kung@clinicofai.com
${phone ? `- Phone: ${phone}` : '- Phone: (not provided — leave pre-filled value untouched; if empty AND required, ABORT)'}
- Location: Lisbon, Portugal (CET/WET timezone)
- Current title: Head of AI / Founder, Clinic of AI
- Years of experience with AI/ML: 8+; GenAI/LLMs: 4+
- Languages: English (fluent), German (native), Portuguese (fluent), French (basic)
- Work authorization: EU/Swiss citizen — authorized to work in EU/CH without sponsorship; needs sponsorship for US/UK
- Willing to relocate: No (remote or hybrid near Lisbon only)
- Notice period: available immediately
- LinkedIn: already logged in on this browser profile`.trim();
}

/**
 * Build human-paced Easy Apply instructions.
 * Reads the JD first and scrolls like a person — pure apply-loops are a known
 * LinkedIn behavioural flag.
 */
function buildTaskInstructions(task: BrowserUseTask): string {
  return `
You are applying to a job on LinkedIn on behalf of Philippe Küng. You are already logged in (persistent profile). Behave like a careful human: scroll naturally, brief pauses between actions, no rapid-fire clicking.

1. Open ${task.jobUrl}
2. Read the job description: scroll down slowly through it (3-5 seconds), then back up.
3. Click "Easy Apply". If there is no Easy Apply button, finish with submitted=false, reason="no_easy_apply_button".
4. Step through the form. Keep any values LinkedIn pre-filled. For empty required fields, use the APPLICANT FACTS below.
${task.coverLetter ? `5. If a cover letter / message field exists, use this text:\n"""${task.coverLetter.slice(0, 900)}"""` : '5. Skip optional cover letter fields.'}
6. If the form asks a REQUIRED question you cannot answer from the facts (salary expectations, visa specifics, niche skill years), DO NOT GUESS: close the modal choosing "Discard"/"Dismiss" and finish with submitted=false, reason="needs_human", listing the questions in unanswered_questions.
7. Otherwise continue to the final review step and click Submit.
8. Wait for the confirmation ("Your application was sent") before finishing with submitted=true.

${applicantFacts()}

Job: ${task.jobTitle} at ${task.company}
`.trim();
}

/**
 * Create an Easy Apply session (async — returns immediately with the session id).
 * The caller stores sessionId and a later cron tick polls getSessionStatus().
 */
export async function createEasyApplySession(task: BrowserUseTask): Promise<SessionCreateResult> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  const profileId = process.env.BROWSER_USE_PROFILE_ID;

  if (!apiKey) {
    return { sessionId: '', liveUrl: null, status: 'not_configured', message: 'BROWSER_USE_API_KEY not set' };
  }
  if (!profileId) {
    // Refuse to run without a persistent profile — fresh logins endanger the account.
    return {
      sessionId: '',
      liveUrl: null,
      status: 'not_configured',
      message: 'BROWSER_USE_PROFILE_ID not set. Create a profile at cloud.browser-use.com, log in to LinkedIn in it once, and set the env var. Refusing to run without a persistent profile (account safety).',
    };
  }

  try {
    const response = await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: apiHeaders(apiKey),
      body: JSON.stringify({
        task: buildTaskInstructions(task),
        profileId,
        proxyCountryCode: 'pt',
        maxCostUsd: Number(process.env.BROWSER_USE_MAX_COST_USD || 1.5),
        outputSchema: {
          type: 'object',
          properties: {
            submitted: { type: 'boolean' },
            reason: { type: 'string' },
            unanswered_questions: { type: 'array', items: { type: 'string' } },
          },
          required: ['submitted', 'reason'],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      const status = response.status === 402 ? 'no_credits' as const : 'failed' as const;
      return { sessionId: '', liveUrl: null, status, message: `API ${response.status}: ${error.slice(0, 200)}` };
    }

    const data = await response.json();
    return {
      sessionId: String(data.id || data.sessionId || ''),
      liveUrl: data.liveUrl ? String(data.liveUrl) : null,
      status: 'queued',
      message: `Easy Apply session started for ${task.company} — ${task.jobTitle}`,
    };
  } catch (err) {
    return { sessionId: '', liveUrl: null, status: 'failed', message: err instanceof Error ? err.message : String(err) };
  }
}

/** Poll a session: status + structured output. */
export async function getSessionStatus(sessionId: string): Promise<SessionStatusResult> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  const unknown: SessionStatusResult = { sessionId, status: 'unknown', submitted: false, detail: '', done: false, costUsd: null };
  if (!apiKey || !sessionId) return unknown;

  try {
    const response = await fetch(`${BASE_URL}/sessions/${sessionId}`, { headers: apiHeaders(apiKey) });
    if (!response.ok) return { ...unknown, detail: `API ${response.status}` };

    const data = await response.json();
    const status = String(data.status || 'unknown') as SessionStatusResult['status'];
    const done = ['stopped', 'timed_out', 'error'].includes(status);

    let submitted = false;
    let detail = '';
    try {
      const output: Partial<EasyApplyOutput> = typeof data.output === 'string' ? JSON.parse(data.output) : (data.output || {});
      submitted = Boolean(output.submitted) && Boolean(data.isTaskSuccessful ?? true);
      detail = [
        output.reason,
        output.unanswered_questions?.length ? `unanswered: ${output.unanswered_questions.join('; ')}` : null,
      ].filter(Boolean).join(' — ');
    } catch {
      detail = typeof data.output === 'string' ? data.output.slice(0, 300) : '';
    }

    return {
      sessionId,
      status,
      submitted,
      detail,
      done,
      costUsd: data.totalCostUsd != null ? Number(data.totalCostUsd) : null,
    };
  } catch (err) {
    return { ...unknown, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Stop a running session (also flushes profile cookies — call on cleanup). */
export async function stopSession(sessionId: string): Promise<boolean> {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey || !sessionId) return false;
  try {
    const response = await fetch(`${BASE_URL}/sessions/${sessionId}/stop`, {
      method: 'POST',
      headers: apiHeaders(apiKey),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type { BrowserUseTask, SessionCreateResult, SessionStatusResult, EasyApplyOutput };
