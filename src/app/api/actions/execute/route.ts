import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { createEasyApplySession, createWebsiteApplySession, getSessionStatus, stopSession, checkCredits } from '@/lib/browser-use';
import type { ActionPayload } from '@/types/triage';

/**
 * /api/actions/execute — the execution engine that was missing.
 *
 * Before this route existed, "Approve" only flipped action_status to 'approved'
 * and NOTHING ever picked those items up: no cron, no UI call. Approved items
 * aged into SLA breaches forever. This route closes the loop.
 *
 * GET  (Vercel cron, 3x/day at human-ish minutes, CRON_SECRET-protected):
 *   A. FINALIZE  — poll Browser Use sessions for items stuck in 'executing';
 *                  mark executed (and insert a job_applications row) ONLY when
 *                  the agent confirmed submitted=true. Timeouts are stopped+failed.
 *   B. PACE      — enforce DAILY_APPLY_CAP (default 5/day), MAX_PER_RUN
 *                  (default 2/window) and a random 12% skip so the cadence
 *                  never looks machine-regular. Weekends run at half cap.
 *   C. LAUNCH    — start Browser Use sessions for the oldest-highest-score
 *                  approved apply_job_easy items within the remaining budget.
 *   D. FOLLOW-UP — applications silent for 7+ days get a drafted follow-up in
 *                  the Review queue; silent 21+ days get marked ghosted.
 *
 * POST {id} (manual "Run now" from the dashboard): launches a single approved
 * item immediately. Counts toward the daily cap.
 */
export const maxDuration = 300;

const EXECUTING_TIMEOUT_MIN = 45;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

async function logHealth(
  source: string,
  operation: string,
  status: 'ok' | 'error' | 'skipped',
  itemsCount: number,
  durationMs: number,
  errorMessage?: string
): Promise<void> {
  try {
    await supabaseServer.from('system_health').insert({
      cron_run_id: crypto.randomUUID(),
      source,
      operation,
      status,
      items_count: itemsCount,
      duration_ms: durationMs,
      error_message: errorMessage || null,
    });
  } catch {
    console.error(`Failed to log health: ${source}/${operation}`);
  }
}

/** Insert the pipeline row — only called once a submission is CONFIRMED. */
async function recordApplication(item: Record<string, unknown>, method: 'easy_apply' | 'website'): Promise<void> {
  await supabaseServer.from('job_applications').insert({
    company: item.company || '',
    role: item.role_title || item.title || '',
    job_url: item.source_url || '',
    location: item.location || '',
    salary_range: item.salary_range || '',
    job_type: item.job_type || '',
    method,
    status: 'applied',
    applied_date: todayStr(),
    last_activity_date: todayStr(),
    cover_letter: item.cover_letter || '',
    tailored_cv_notes: item.tailored_cv_notes || '',
    source_triage_id: item.id,
    score: item.score || 0,
    score_label: item.score_label || null,
  });
}

/** STEP A — finalize in-flight Browser Use sessions. */
async function finalizeExecuting(): Promise<{ executed: number; failed: number; stillRunning: number; readyToSend: number }> {
  const out = { executed: 0, failed: 0, stillRunning: 0, readyToSend: 0 };

  const { data: executing } = await supabaseServer
    .from('triage_items')
    .select('*')
    .eq('action_status', 'executing')
    .in('action_type', ['apply_job_easy', 'apply_job_website']);

  for (const item of executing || []) {
    const payload = (item.action_payload || {}) as ActionPayload;
    const sessionId = payload.browser_use_session_id;

    if (!sessionId) {
      // Legacy item stuck in 'executing' from the dead v1 integration — fail it honestly.
      await supabaseServer.from('triage_items').update({
        action_status: 'failed',
        notes: 'Stuck in executing with no session id (legacy v1 integration). Re-approve to retry via v3.',
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      out.failed++;
      continue;
    }

    const session = await getSessionStatus(sessionId);

    if (!session.done) {
      const startedAt = payload.execution_started_at ? new Date(payload.execution_started_at).getTime() : 0;
      const ageMin = startedAt ? (Date.now() - startedAt) / 60000 : 0;
      if (ageMin > EXECUTING_TIMEOUT_MIN) {
        await stopSession(sessionId);
        await supabaseServer.from('triage_items').update({
          action_status: 'failed',
          notes: `Session timed out after ${Math.round(ageMin)} min — stopped. ${session.detail}`.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', item.id);
        out.failed++;
      } else {
        out.stillRunning++;
      }
      continue;
    }

    if (session.submitted) {
      await supabaseServer.from('triage_items').update({
        action_status: 'executed',
        notes: `Application submitted ✓ (verified by agent). Cost $${session.costUsd ?? '?'}`,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      await recordApplication(item, item.action_type === 'apply_job_easy' ? 'easy_apply' : 'website');
      out.executed++;
    } else if (item.action_type === 'apply_job_website' && session.detail.includes('ready_to_send')) {
      // Fill-then-hold: the agent filled the whole form and stopped at the
      // final submit button. Session stays alive (keepAlive) — Philippe
      // reviews via liveUrl and clicks Send on the dashboard.
      await supabaseServer.from('triage_items').update({
        action_status: 'approved',
        action_payload: { ...payload, ready_to_send: 'true' },
        notes: `Filled and waiting for your Send ✓ Review live: ${payload.browser_use_live_url || 'see dashboard'}`,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      out.readyToSend++;
    } else {
      const needsHuman = session.detail.includes('needs_human');
      await supabaseServer.from('triage_items').update({
        action_status: 'failed',
        notes: needsHuman
          ? `Needs you: the form asked questions the agent would not guess. ${session.detail}`
          : `Easy Apply failed: ${session.detail || session.status}`,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      out.failed++;
    }
  }

  return out;
}

/** STEP B — how many applications may we still launch today? */
async function remainingBudget(): Promise<{ remaining: number; cap: number; usedToday: number }> {
  const baseCap = Number(process.env.DAILY_APPLY_CAP || 5);
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;
  const cap = isWeekend ? Math.max(1, Math.floor(baseCap / 2)) : baseCap;

  const { count } = await supabaseServer
    .from('job_applications')
    .select('id', { count: 'exact', head: true })
    .eq('method', 'easy_apply')
    .eq('applied_date', todayStr());

  // Also count in-flight sessions so a burst of crons can't overshoot the cap
  const { count: inFlight } = await supabaseServer
    .from('triage_items')
    .select('id', { count: 'exact', head: true })
    .eq('action_status', 'executing')
    .eq('action_type', 'apply_job_easy');

  const usedToday = (count || 0) + (inFlight || 0);
  return { remaining: Math.max(0, cap - usedToday), cap, usedToday };
}

/** STEP C — launch sessions for approved Easy Apply items. */
async function launchApproved(budget: number, maxPerRun: number): Promise<{ launched: number; errors: string[] }> {
  const errors: string[] = [];
  let launched = 0;

  const toLaunch = Math.min(budget, maxPerRun);
  if (toLaunch <= 0) return { launched, errors };

  const { data: approved } = await supabaseServer
    .from('triage_items')
    .select('*')
    .eq('action_status', 'approved')
    .eq('action_type', 'apply_job_easy')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(toLaunch);

  if (!approved || approved.length === 0) return { launched, errors };

  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (apiKey && !(await checkCredits(apiKey))) {
    errors.push('Browser Use: no credits — top up at cloud.browser-use.com');
    return { launched, errors };
  }

  for (const item of approved) {
    const payload = (item.action_payload || {}) as ActionPayload;
    const result = await createEasyApplySession({
      jobUrl: payload.job_url || item.source_url || '',
      jobTitle: item.role_title || item.title || '',
      company: item.company || '',
      coverLetter: item.cover_letter || null,
    });

    if (result.status === 'queued') {
      await supabaseServer.from('triage_items').update({
        action_status: 'executing',
        action_payload: {
          ...payload,
          browser_use_session_id: result.sessionId,
          browser_use_live_url: result.liveUrl || '',
          execution_started_at: new Date().toISOString(),
        },
        notes: result.liveUrl ? `Applying now — watch live: ${result.liveUrl}` : 'Applying now…',
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      launched++;
    } else {
      errors.push(`${item.company}: ${result.message}`);
      if (result.status === 'not_configured' || result.status === 'no_credits') break; // pointless to keep trying
    }
  }

  return { launched, errors };
}

/** STEP C2 — auto-fill website applications (fill-then-hold, cheap model, no LinkedIn risk).
 * Volume lives here: LinkedIn Easy Apply is capped tightly to protect the
 * account, but each company site is independent — WEBSITE_FILL_CAP (default 20)
 * is bounded by Browser Use cost, not ban risk. This is how 50/day happens.
 */
async function launchWebsiteFills(): Promise<{ launched: number; errors: string[] }> {
  const errors: string[] = [];
  let launched = 0;

  const cap = Number(process.env.WEBSITE_FILL_CAP || 20);
  const perRun = Number(process.env.WEBSITE_FILLS_PER_RUN || 7);

  // Today's already-started fills count toward the cap
  const { count: startedToday } = await supabaseServer
    .from('triage_items')
    .select('id', { count: 'exact', head: true })
    .eq('action_type', 'apply_job_website')
    .gte('updated_at', new Date().toISOString().split('T')[0])
    .not('action_payload->>browser_use_session_id', 'is', null);

  const budget = Math.min(Math.max(0, cap - (startedToday || 0)), perRun);
  if (budget <= 0) return { launched, errors };

  // Approved website items that have a career URL and no session yet
  const { data: approved } = await supabaseServer
    .from('triage_items')
    .select('*')
    .eq('action_status', 'approved')
    .eq('action_type', 'apply_job_website')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(budget * 2); // headroom: some will lack a career URL

  let remaining = budget;
  for (const item of approved || []) {
    if (remaining <= 0) break;
    const payload = (item.action_payload || {}) as ActionPayload;
    if (payload.browser_use_session_id) continue; // already in flight / filled
    const careerUrl = payload.company_career_url || item.contact_url || '';
    if (!careerUrl || careerUrl === item.source_url) continue; // no direct page — stays in manual queue

    const result = await createWebsiteApplySession({
      careerUrl,
      jobTitle: item.role_title || item.title || '',
      company: item.company || '',
      coverLetter: item.cover_letter || null,
      cvNotes: item.tailored_cv_notes || null,
    });

    if (result.status === 'queued') {
      await supabaseServer.from('triage_items').update({
        action_status: 'executing',
        action_payload: {
          ...payload,
          browser_use_session_id: result.sessionId,
          browser_use_live_url: result.liveUrl || '',
          execution_started_at: new Date().toISOString(),
        },
        notes: result.liveUrl ? `Auto-filling on company site \u2014 watch: ${result.liveUrl}` : 'Auto-filling on company site\u2026',
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      launched++;
      remaining--;
    } else {
      errors.push(`${item.company}: ${result.message}`);
      if (result.status === 'not_configured' || result.status === 'no_credits') break;
    }
  }

  return { launched, errors };
}

/** STEP D — follow-ups on silent applications; ghost detection. */
async function followUps(): Promise<{ followupsDrafted: number; ghosted: number }> {
  const out = { followupsDrafted: 0, ghosted: 0 };
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString().split('T')[0];

  const { data: active } = await supabaseServer
    .from('job_applications')
    .select('*')
    .in('status', ['applied', 'screening'])
    .lte('last_activity_date', daysAgo(7));

  for (const app of active || []) {
    // Ghost: 21+ days of total silence
    if ((app.last_activity_date || app.applied_date) <= daysAgo(21)) {
      await supabaseServer.from('job_applications').update({
        status: 'ghosted',
        notes: `${app.notes ? app.notes + ' | ' : ''}Auto-marked ghosted after 21 days of silence.`,
      }).eq('id', app.id);
      out.ghosted++;
      continue;
    }

    // Skip if we already drafted a follow-up recently
    if (app.follow_up_date && app.follow_up_date > daysAgo(7)) continue;

    const draft = `Hi${app.contact_name ? ' ' + app.contact_name : ''},

I applied for the ${app.role} position at ${app.company} on ${app.applied_date} and wanted to follow up — the role is a strong match for my background in GenAI architecture and agentic systems (most recently building multi-agent platforms at Clinic of AI, previously Head of Data & AI at Crayon).

I'd welcome a short call if the position is still open: https://cal.read.ai/philippe-datakult/30-min

Best regards,
Philippe Küng`;

    await supabaseServer.from('triage_items').insert({
      title: `Follow up: ${app.role} at ${app.company}`,
      subtitle: `Applied ${app.applied_date}, no response for 7+ days. Draft ready.`,
      source: 'system',
      category: 'review',
      score: app.score || 0,
      score_label: app.score_label || null,
      priority: 7,
      tags: ['follow-up', 'pipeline'],
      draft_reply: draft,
      contact_name: app.contact_name || app.company,
      contact_url: app.contact_url || app.job_url,
      source_url: app.job_url,
      triage_date: todayStr(),
      action_type: app.contact_email ? 'reply_email' : 'send_message',
      action_payload: app.contact_email
        ? { email_to: app.contact_email, email_subject: `Following up — ${app.role} application`, email_body: draft }
        : { message_text: draft },
      action_status: 'pending_review',
    });

    await supabaseServer.from('job_applications').update({ follow_up_date: todayStr() }).eq('id', app.id);
    out.followupsDrafted++;
  }

  return out;
}

async function runExecutor(opts: { jitterSkip: boolean }) {
  const startTime = Date.now();

  // A. Always finalize first — even on jitter-skip runs (polling is invisible to LinkedIn)
  const finalized = await finalizeExecuting();

  // B. Pacing
  const budget = await remainingBudget();
  const maxPerRun = Number(process.env.MAX_APPLIES_PER_RUN || 2);
  const skipped = opts.jitterSkip && Math.random() < 0.12;

  // C. Launch LinkedIn Easy Apply (tight cap — account safety)
  const launch = skipped
    ? { launched: 0, errors: [] as string[] }
    : await launchApproved(budget.remaining, maxPerRun);

  // C2. Launch website fills (volume — cost-bound, not ban-bound)
  const websiteFills = await launchWebsiteFills();

  // D. Follow-ups + ghosts
  const followup = await followUps();

  const summary = {
    finalized,
    pacing: { ...budget, maxPerRun, jitterSkipped: skipped },
    launch,
    websiteFills,
    followup,
    duration_ms: Date.now() - startTime,
  };

  await logHealth(
    'executor',
    'execute_approved',
    launch.errors.length + websiteFills.errors.length > 0 ? 'error' : 'ok',
    finalized.executed + launch.launched + websiteFills.launched,
    summary.duration_ms,
    [...launch.errors, ...websiteFills.errors].join('; ') || undefined
  );

  return summary;
}

/** Cron entrypoint */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const summary = await runExecutor({ jitterSkip: true });
  return NextResponse.json({ success: true, ...summary });
}

/** Manual "Run now" from the dashboard — single item, no jitter skip. */
export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Verify the item is approved Easy Apply
    const { data: item } = await supabaseServer
      .from('triage_items')
      .select('id, action_status, action_type')
      .eq('id', id)
      .single();

    if (!item || item.action_status !== 'approved' || item.action_type !== 'apply_job_easy') {
      return NextResponse.json({ error: 'Item is not an approved Easy Apply action' }, { status: 400 });
    }

    const budget = await remainingBudget();
    if (budget.remaining <= 0) {
      return NextResponse.json({
        error: `Daily cap reached (${budget.usedToday}/${budget.cap}). Protecting your LinkedIn account — try tomorrow.`,
      }, { status: 429 });
    }

    // Temporarily narrow the launch to this one item by score trick: launch directly
    const finalized = await finalizeExecuting();
    const { data: full } = await supabaseServer.from('triage_items').select('*').eq('id', id).single();
    if (!full) return NextResponse.json({ error: 'Item vanished' }, { status: 404 });

    const payload = (full.action_payload || {}) as ActionPayload;
    const result = await createEasyApplySession({
      jobUrl: payload.job_url || full.source_url || '',
      jobTitle: full.role_title || full.title || '',
      company: full.company || '',
      coverLetter: full.cover_letter || null,
    });

    if (result.status !== 'queued') {
      return NextResponse.json({ error: result.message }, { status: 502 });
    }

    await supabaseServer.from('triage_items').update({
      action_status: 'executing',
      action_payload: {
        ...payload,
        browser_use_session_id: result.sessionId,
        browser_use_live_url: result.liveUrl || '',
        execution_started_at: new Date().toISOString(),
      },
      notes: result.liveUrl ? `Applying now — watch live: ${result.liveUrl}` : 'Applying now…',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ success: true, sessionId: result.sessionId, liveUrl: result.liveUrl, finalized });
  } catch (err) {
    console.error('Manual execute error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
