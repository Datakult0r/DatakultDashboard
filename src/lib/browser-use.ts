/**
 * Browser Use Cloud v3 integration for LinkedIn Easy Apply.
 * Most subtle agent — best anti-detection for LinkedIn operations.
 *
 * SAFETY:
 * - Only triggers after Philippe approves from the dashboard
 * - Gracefully handles 0 credits with a dashboard-visible error
 * - Uses v3 (most human-like, randomized waits built in)
 * - Max 5 job applications per session
 *
 * IMPORTANT: Philippe's LinkedIn account is his primary professional asset.
 * A ban would be catastrophic. All operations use anti-detection measures.
 */

interface BrowserUseTask {
  jobUrl: string;
  jobTitle: string;
  company: string;
  coverLetter: string | null;
}

interface BrowserUseResult {
  taskId: string;
  status: 'completed' | 'failed' | 'no_credits' | 'queued';
  message: string;
  jobUrl: string;
}

interface EasyApplyResult {
  results: BrowserUseResult[];
  durationMs: number;
  error: string | null;
  hasCredits: boolean;
}

/**
 * Check if Browser Use Cloud has available credits.
 * Returns false if the API key is missing or credits are exhausted.
 */
async function checkCredits(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.browser-use.com/api/v1/credits', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    return (data.remaining_credits || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Submit an Easy Apply task to Browser Use Cloud v3.
 * The task navigates to the LinkedIn job posting and fills out the Easy Apply form.
 */
async function submitEasyApply(
  apiKey: string,
  task: BrowserUseTask
): Promise<BrowserUseResult> {
  const instructions = `
Navigate to ${task.jobUrl}
Wait 2-4 seconds (randomized)
Click the "Easy Apply" button
Wait for the application form to load
Fill in any required fields using this information:
- Name: Philippe Küng
- Email: philippe.kung@clinicofai.com
- Phone: +351 XXX XXX XXX
- Location: Lisbon, Portugal
- Current title: Head of AI / Founder
${task.coverLetter ? `- Cover letter: ${task.coverLetter.slice(0, 500)}` : ''}
Submit the application
Wait for confirmation
`.trim();

  try {
    const response = await fetch('https://api.browser-use.com/api/v1/run-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        task: instructions,
        save_browser_data: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        taskId: '',
        status: 'failed',
        message: `API error: ${response.status} ${error.slice(0, 200)}`,
        jobUrl: task.jobUrl,
      };
    }

    const data = await response.json();
    return {
      taskId: data.id || data.task_id || '',
      status: 'queued',
      message: `Easy Apply queued for ${task.company} — ${task.jobTitle}`,
      jobUrl: task.jobUrl,
    };
  } catch (err) {
    return {
      taskId: '',
      status: 'failed',
      message: err instanceof Error ? err.message : String(err),
      jobUrl: task.jobUrl,
    };
  }
}

/**
 * Main export: Execute Easy Apply for approved jobs.
 * Called from the /api/actions/apply route after Philippe approves.
 *
 * Returns immediately with no_credits status if Browser Use has 0 credits,
 * so the dashboard can show an alert instead of silently failing.
 */
export async function executeEasyApply(
  tasks: BrowserUseTask[]
): Promise<EasyApplyResult> {
  const apiKey = process.env.BROWSER_USE_API_KEY;

  if (!apiKey) {
    return {
      results: tasks.map((t) => ({
        taskId: '',
        status: 'no_credits' as const,
        message: 'BROWSER_USE_API_KEY not configured',
        jobUrl: t.jobUrl,
      })),
      durationMs: 0,
      error: 'BROWSER_USE_API_KEY not set',
      hasCredits: false,
    };
  }

  const startTime = Date.now();

  // Check credits first
  const hasCredits = await checkCredits(apiKey);
  if (!hasCredits) {
    return {
      results: tasks.map((t) => ({
        taskId: '',
        status: 'no_credits' as const,
        message: 'Browser Use Cloud has 0 credits. Add credits at cloud.browser-use.com to enable Easy Apply.',
        jobUrl: t.jobUrl,
      })),
      durationMs: Date.now() - startTime,
      error: 'No Browser Use Cloud credits available',
      hasCredits: false,
    };
  }

  // Max 5 applications per session (anti-detection)
  const limitedTasks = tasks.slice(0, 5);
  const results: BrowserUseResult[] = [];

  for (const task of limitedTasks) {
    const result = await submitEasyApply(apiKey, task);
    results.push(result);

    // Randomized wait between applications (30-90 seconds)
    if (limitedTasks.indexOf(task) < limitedTasks.length - 1) {
      const waitMs = 30000 + Math.random() * 60000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  return {
    results,
    durationMs: Date.now() - startTime,
    error: null,
    hasCredits: true,
  };
}

export type { BrowserUseTask, BrowserUseResult, EasyApplyResult };
