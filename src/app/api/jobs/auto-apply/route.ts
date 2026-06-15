/**
 * GET /api/jobs/auto-apply   (Vercel cron, 09:00 UTC daily — see vercel.json)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ANTI-DETECTION (read this before adding any new code path):
 *
 *   Only TWO browser controllers are sanctioned for this pipeline:
 *     1. Browser Use Cloud v3 (server-side, via executeEasyApply / executeWebsiteApply)
 *     2. computer-use         (desktop-only, NOT used here — cron has no desktop)
 *
 *   DO NOT introduce Playwright, Puppeteer, Selenium, undetected-chromedriver,
 *   rebrowser-* patches, or any self-hosted Chromium. Not as primary, fallback,
 *   or experiment. LinkedIn's bot detection actively probes IP fingerprints,
 *   storageState replay anomalies, and CDP runtime signatures faster than any
 *   open-source patch can keep up. linkedin.com/in/pkfde is Philippe's #1
 *   asset and not negotiable. See memory: feedback_no_playwright.md.
 *
 *   The anti-detection envelope below (cap, randomized delays, halt-on-failure,
 *   24h cool-off) is ALSO non-negotiable. Do not lower any of these values.
 * ────────────────────────────────────────────────────────────────────────────
 * DATA-SOURCE PRIORITY (read this before changing anything):
 *
 *   PRIMARY:   triage_items where action_status='approved'
 *              AND action_type IN ('apply_job_easy','apply_job_website')
 *              AND cover_letter IS NOT NULL.
 *
 *   FALLBACK:  philippe_jobs where decision='STRONG_APPLY'
 *              AND apply_type='easy_apply' AND apply_status='SCORED'.
 *              Kept ONLY for backward compatibility with the legacy bumps
 *              discovery pipeline that still writes to philippe_jobs.
 *              If `triage_items` returns ≥1 row, philippe_jobs is skipped.
 *
 *   Before 2026-05-13, this cron ONLY read philippe_jobs and was filtered to
 *   apply_type='easy_apply', which had 0 rows. The dashboard writes all
 *   approved drafts to triage_items, so the cron processed nothing — 35 cover
 *   letters drafted in 7 days, 0 sent. See feedback_apply_pipeline.md.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * STATE MACHINE (triage_items.action_status for apply_job_* rows):
 *   pending_review → (Philippe approves)
 *   → approved     → (cron picks up)
 *   → executing    → (Browser Use call in flight)
 *   → executed     → success (job_applications row also inserted)
 *   OR → failed    → halts the rest of this run (anti-detection)
 *
 * ANTI-DETECTION (do not lower these without reading
 * feedback_no_playwright.md and feedback_linkedin_protocol.md):
 *   - Max AUTO_APPLY_DAILY_CAP per cron run (default 3, hard ceiling 10)
 *   - 90-180s randomized delay between submissions
 *   - HALT immediately on first failure within this run
 *   - HALT entire run if a FAILED row from the last 24h is detected
 *     (one bad signal → cool-off the whole day)
 *
 * RESPONSE SHAPE:
 *   { ok: true, source: 'triage_items'|'philippe_jobs',
 *     autoApplied: <int>, queueSize: <int>, cap: <int>,
 *     paused?: true, results: [...] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { executeEasyApply, executeWebsiteApply, getSessionVerification, stopSession } from '@/lib/browser-use';
import type { BrowserUseTask } from '@/lib/browser-use';
import type { ActionPayload } from '@/types/triage';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const DEFAULT_CAP = 3;
const HARD_CEILING = 10;
const MIN_DELAY_MS = 90_000;
const MAX_DELAY_MS = 180_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function logHealth(
  source: string,
  operation: string,
  status: 'ok' | 'error' | 'skipped' | 'fallback',
  itemsCount: number,
  durationMs: number,
  errorMessage?: string,
  fallback?: string,
) {
  try {
    await supabaseServer.from('system_health').insert({
      source,
      operation,
      status,
      items_count: itemsCount,
      duration_ms: durationMs,
      error_message: errorMessage ?? null,
      fallback_used: fallback ?? null,
    });
  } catch {
    // logging must never throw
  }
}

type TriageJobRow = {
  id: string;
  company: string | null;
  role_title: string | null;
  title: string | null;
  source_url: string | null;
  cover_letter: string | null;
  tailored_cv_notes: string | null;
  location: string | null;
  salary_range: string | null;
  job_type: string | null;
  score: number | null;
  score_label: string | null;
  action_type: 'apply_job_easy' | 'apply_job_website';
  action_payload: ActionPayload | null;
};

type LegacyJobRow = {
  id: string;
  title: string;
  company: string;
  job_url: string | null;
  cover_note: string | null;
};

type RunResult = {
  id: string;
  ok: boolean;
  reason: string | null;
  sessionId: string | null;
  source: 'triage_items' | 'philippe_jobs';
};

/**
 * Benign agent refusals — honest "I didn't apply" outcomes, NOT bot-detection
 * signals. They must not trigger the 24h auto-pause or halt the run.
 */
const BENIGN_REASONS = ['needs_human', 'needs_cv_upload', 'needs_account', 'ready_to_send', 'no_easy_apply_button', 'job_not_found', 'no_job_url', 'skipped_required_field', 'stuck', 'no session id', 're-approve'];

function isBenign(reason: string | null | undefined): boolean {
  return Boolean(reason && BENIGN_REASONS.some((b) => reason.includes(b)));
}

const EXECUTING_TIMEOUT_MIN = 45;

/**
 * FINALIZE: poll Browser Use sessions for items left in 'executing'.
 * Only a verified submitted=true becomes executed + a job_applications row —
 * a QUEUED session is not an application (the old code marked executed on
 * queue, which is how the pipeline filled with phantom "applied" rows).
 */
async function finalizeExecuting(): Promise<{ executed: number; failed: number; running: number }> {
  const out = { executed: 0, failed: 0, running: 0 };
  const { data: executing } = await supabaseServer
    .from('triage_items')
    .select('*')
    .eq('action_status', 'executing')
    .in('action_type', ['apply_job_easy', 'apply_job_website']);

  for (const item of executing ?? []) {
    const payload = (item.action_payload ?? {}) as ActionPayload;
    const sessionId = (payload.browser_use_session_id as string) || '';
    const nowIso = new Date().toISOString();

    if (!sessionId) {
      await supabaseServer.from('triage_items').update({
        action_status: 'failed',
        notes: 'Stuck in executing with no session id — re-approve to retry.',
        updated_at: nowIso,
      }).eq('id', item.id);
      out.failed++;
      continue;
    }

    const v = await getSessionVerification(sessionId);

    if (!v.done) {
      const startedAt = payload.last_attempt_at ? new Date(payload.last_attempt_at as string).getTime() : 0;
      const ageMin = startedAt ? (Date.now() - startedAt) / 60000 : 0;
      if (ageMin > EXECUTING_TIMEOUT_MIN) {
        await stopSession(sessionId);
        await supabaseServer.from('triage_items').update({
          action_status: 'failed',
          notes: `Session timed out after ${Math.round(ageMin)} min — stopped. ${v.detail}`.trim(),
          updated_at: nowIso,
        }).eq('id', item.id);
        out.failed++;
      } else {
        out.running++;
      }
      continue;
    }

    if (v.submitted) {
      await supabaseServer.from('triage_items').update({
        action_status: 'executed',
        notes: `Application submitted ✓ (verified).`,
        action_payload: { ...payload, sent_at: nowIso },
        updated_at: nowIso,
      }).eq('id', item.id);
      await supabaseServer.from('job_applications').insert({
        company: item.company || '',
        role: item.role_title || item.title || '',
        job_url: (payload.job_url as string) || item.source_url || '',
        location: item.location || '',
        salary_range: item.salary_range || '',
        job_type: item.job_type || '',
        method: item.action_type === 'apply_job_easy' ? 'easy_apply' : 'website',
        status: 'applied',
        applied_date: nowIso.split('T')[0],
        last_activity_date: nowIso.split('T')[0],
        cover_letter: item.cover_letter || '',
        tailored_cv_notes: item.tailored_cv_notes || '',
        source_triage_id: item.id,
        score: item.score || 0,
        score_label: item.score_label || null,
      });
      out.executed++;
    } else if (isBenign(v.detail)) {
      // Fill-then-hold: the agent prepared the application; it now needs Philippe to
      // finish (log in / review & send). Surface as an actionable item in his queue
      // with the job link — NOT a failure, so it never trips the cool-off.
      const jobUrl = (payload.job_url as string) || item.source_url || '';
      const liveUrl = (payload.browser_use_live_url as string) || '';
      await supabaseServer.from('triage_items').update({
        action_status: 'pending_review',
        notes: `🟡 READY — finish & send: ${jobUrl}${liveUrl ? ` · live: ${liveUrl}` : ''}. Cover letter is on this item. (${v.detail})`,
        updated_at: nowIso,
      }).eq('id', item.id);
      out.running++;
    } else {
      await supabaseServer.from('triage_items').update({
        action_status: 'failed',
        notes: `Apply failed: ${v.detail || v.status}`,
        updated_at: nowIso,
      }).eq('id', item.id);
      out.failed++;
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();

  // FINALIZE previous sessions first — polling is invisible to LinkedIn and
  // turns 'executing' into verified outcomes before we decide today's budget.
  const finalized = await finalizeExecuting();

  const cap = Math.max(
    1,
    Math.min(HARD_CEILING, Number(process.env.AUTO_APPLY_DAILY_CAP ?? DEFAULT_CAP)),
  );

  // ── Auto-pause: ONLY a real LinkedIn Easy Apply failure in the last 24h cools off
  // (account-safety). Company-website apply failures are site/cost issues, not a
  // LinkedIn detection signal, so they must NEVER freeze the pipeline.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [legacyFailed, triageFailed] = await Promise.all([
    supabaseServer
      .from('philippe_jobs')
      .select('id')
      .eq('apply_status', 'FAILED')
      .gte('updated_at', since24h)
      .limit(1),
    supabaseServer
      .from('triage_items')
      .select('id, notes')
      .eq('action_status', 'failed')
      .eq('action_type', 'apply_job_easy')
      .gte('updated_at', since24h)
      .limit(10),
  ]);

  // Benign refusals (needs_human / needs_cv_upload / …) are honest outcomes,
  // not detection signals — they must not freeze the pipeline for 24h.
  const realTriageFailures = (triageFailed.data ?? []).filter(
    (r) => !isBenign((r as { notes?: string | null }).notes)
  );

  if (
    (legacyFailed.data && legacyFailed.data.length > 0) ||
    realTriageFailures.length > 0
  ) {
    await logHealth(
      'browser_use',
      'auto_apply',
      'skipped',
      0,
      Date.now() - start,
      'Auto-paused: a FAILED row in the last 24h',
      'auto_pause_24h',
    );
    return NextResponse.json({ ok: true, autoApplied: 0, paused: true });
  }

  // ── PRIMARY: pull approved drafts from triage_items
  const { data: triageQueue, error: triageErr } = await supabaseServer
    .from('triage_items')
    .select(
      'id,company,role_title,title,source_url,cover_letter,tailored_cv_notes,location,salary_range,job_type,score,score_label,action_type,action_payload',
    )
    .eq('action_status', 'approved')
    .in('action_type', ['apply_job_easy', 'apply_job_website'])
    .not('cover_letter', 'is', null)
    .order('score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(cap);

  if (triageErr) {
    await logHealth('browser_use', 'auto_apply', 'error', 0, Date.now() - start, triageErr.message);
    return NextResponse.json({ error: triageErr.message }, { status: 500 });
  }

  // ── If triage_items returned rows, process them
  if (triageQueue && triageQueue.length > 0) {
    const results = await processTriageQueue(triageQueue as TriageJobRow[]);
    const successCount = results.filter((r) => r.ok).length;
    await logHealth(
      'browser_use',
      'auto_apply',
      successCount === results.length ? 'ok' : 'fallback',
      successCount,
      Date.now() - start,
      successCount === results.length
        ? undefined
        : `Submitted ${successCount}/${results.length} from triage_items`,
      successCount === results.length ? undefined : 'partial_submit',
    );
    return NextResponse.json({
      ok: true,
      source: 'triage_items',
      sessionsStarted: successCount,
      finalized,
      queueSize: triageQueue.length,
      cap,
      results,
    });
  }

  // ── FALLBACK: legacy philippe_jobs path (only if triage_items was empty)
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: legacyQueue, error: legacyErr } = await supabaseServer
    .from('philippe_jobs')
    .select('id,title,company,job_url,cover_note')
    .eq('decision', 'STRONG_APPLY')
    .eq('apply_type', 'easy_apply')
    .eq('apply_status', 'SCORED')
    .not('cover_note', 'is', null)
    .not('job_url', 'is', null)
    .gte('created_at', since7d)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(cap);

  if (legacyErr) {
    await logHealth('browser_use', 'auto_apply', 'error', 0, Date.now() - start, legacyErr.message);
    return NextResponse.json({ error: legacyErr.message }, { status: 500 });
  }

  if (!legacyQueue || legacyQueue.length === 0) {
    await logHealth(
      'browser_use',
      'auto_apply',
      'ok',
      0,
      Date.now() - start,
      undefined,
      'queue_empty',
    );
    return NextResponse.json({
      ok: true,
      source: null,
      autoApplied: 0,
      queueSize: 0,
      cap,
      note: 'Both triage_items and philippe_jobs queues are empty.',
    });
  }

  const results = await processLegacyQueue(legacyQueue as LegacyJobRow[]);
  const successCount = results.filter((r) => r.ok).length;
  await logHealth(
    'browser_use',
    'auto_apply',
    successCount === results.length ? 'ok' : 'fallback',
    successCount,
    Date.now() - start,
    successCount === results.length
      ? undefined
      : `Submitted ${successCount}/${results.length} from philippe_jobs (legacy)`,
    successCount === results.length ? undefined : 'partial_submit',
  );

  return NextResponse.json({
    ok: true,
    source: 'philippe_jobs',
    autoApplied: successCount,
    queueSize: legacyQueue.length,
    cap,
    results,
  });
}

/**
 * Process approved drafts from triage_items. Routes easy_apply and website_apply
 * to their respective Browser Use executors, updates action_status through the
 * state machine, and inserts a job_applications row on success.
 */
async function processTriageQueue(queue: TriageJobRow[]): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    // Mark executing
    await supabaseServer
      .from('triage_items')
      .update({ action_status: 'executing', updated_at: new Date().toISOString() })
      .eq('id', item.id);

    const payload = (item.action_payload ?? {}) as ActionPayload;
    const jobUrl = payload?.job_url || item.source_url || '';
    const task: BrowserUseTask = {
      jobUrl,
      jobTitle: item.role_title || item.title || '',
      company: item.company || '',
      coverLetter: item.cover_letter,
    };

    if (!task.jobUrl) {
      await supabaseServer
        .from('triage_items')
        .update({
          action_status: 'failed',
          notes: 'No job URL on record (source_url AND action_payload.job_url both empty).',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      results.push({ id: item.id, ok: false, reason: 'no_job_url', sessionId: null, source: 'triage_items' });
      break; // halt on failure (anti-detection)
    }

    const submitResult =
      item.action_type === 'apply_job_easy'
        ? await executeEasyApply([task])
        : await executeWebsiteApply([task]);

    const r0 = submitResult.results?.[0];
    // 'queued' means the cloud session STARTED — it is NOT a submitted
    // application. Mark executing; the next cron run verifies the outcome
    // (finalizeExecuting) and only then records an application.
    const ok = Boolean(r0 && r0.status === 'queued');
    const sessionId = r0?.taskId ?? null;
    const reason = r0?.message ?? submitResult.error ?? null;
    const nowIso = new Date().toISOString();

    await supabaseServer
      .from('triage_items')
      .update({
        action_status: ok ? 'executing' : 'failed',
        notes: ok ? `Applying now — session ${sessionId}` : reason ?? undefined,
        action_payload: {
          ...payload,
          browser_use_session_id: sessionId,
          last_attempt_at: nowIso,
          last_attempt_reason: reason ?? null,
        },
        updated_at: nowIso,
      })
      .eq('id', item.id);

    // NOTE: no job_applications insert here — that happens ONLY in
    // finalizeExecuting() after the agent confirms submitted=true.

    results.push({ id: item.id, ok, reason, sessionId, source: 'triage_items' });

    if (!ok && !isBenign(reason)) {
      // Halt-on-failure: a non-benign failure may be a detection signal —
      // do not submit the rest of the queue in this run.
      break;
    }

    if (i < queue.length - 1) {
      await sleep(randInt(MIN_DELAY_MS, MAX_DELAY_MS));
    }
  }

  return results;
}

/**
 * Legacy philippe_jobs processing — unchanged from pre-2026-05-13 behavior.
 * Only invoked when triage_items.approved queue is empty.
 */
async function processLegacyQueue(queue: LegacyJobRow[]): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    await supabaseServer.from('philippe_jobs').update({ apply_status: 'APPLYING' }).eq('id', job.id);

    const submitResult = await executeEasyApply([
      {
        jobUrl: job.job_url!,
        jobTitle: job.title,
        company: job.company,
        coverLetter: job.cover_note,
      },
    ]);

    const r0 = submitResult.results?.[0];
    const ok = Boolean(r0 && (r0.status === 'completed' || r0.status === 'queued'));
    const sessionId = r0?.taskId ?? null;
    const reason = r0?.message ?? submitResult.error ?? null;

    await supabaseServer
      .from('philippe_jobs')
      .update({
        apply_status: ok ? 'APPLIED' : 'FAILED',
        apply_reason: reason,
        browser_use_session_id: sessionId,
      })
      .eq('id', job.id);

    results.push({ id: job.id, ok, reason, sessionId, source: 'philippe_jobs' });

    if (!ok) break;
    if (i < queue.length - 1) await sleep(randInt(MIN_DELAY_MS, MAX_DELAY_MS));
  }

  return results;
}
