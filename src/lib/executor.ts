/**
 * Execution engine — shared by /api/actions/execute (cron), /api/actions/apply
 * (manual batch) and the dashboard Run-now button. Pacing, finalization,
 * website fills and follow-ups live here so every entrypoint enforces the
 * same safety rules.
 */
import { supabaseServer } from '@/lib/supabase-server';
import { createEasyApplySession, createWebsiteApplySession, createDmSweepSession, getSessionStatus, getSessionOutput, stopSession, checkCredits } from '@/lib/browser-use';
import type { ActionPayload } from '@/types/triage';

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export async function logHealth(
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

const EXECUTING_TIMEOUT_MIN = 45;


/** Insert the pipeline row — only called once a submission is CONFIRMED. */
export async function recordApplication(item: Record<string, unknown>, method: 'easy_apply' | 'website'): Promise<void> {
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
export async function finalizeExecuting(): Promise<{ executed: number; failed: number; stillRunning: number; readyToSend: number }> {
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

  // Expire fill-then-hold items older than 20h: the held browser session is
  // long dead — push them to the manual queue with materials intact instead of
  // letting a dead "Send" button rot in the UI.
  const twentyHoursAgo = new Date(Date.now() - 20 * 3600000).toISOString();
  const { data: staleReady } = await supabaseServer
    .from('triage_items')
    .select('id, action_payload, notes')
    .eq('action_status', 'approved')
    .eq('action_type', 'apply_job_website')
    .lt('updated_at', twentyHoursAgo);
  for (const stale of staleReady || []) {
    const p = (stale.action_payload || {}) as ActionPayload;
    if (p.ready_to_send !== 'true') continue;
    await supabaseServer.from('triage_items').update({
      action_payload: { ...p, ready_to_send: 'expired' },
      notes: 'Held session expired — click Send to re-fill and submit automatically, or apply manually.',
      updated_at: new Date().toISOString(),
    }).eq('id', stale.id);
  }

  return out;
}

/** STEP B — how many applications may we still launch today? */
export async function remainingBudget(): Promise<{ remaining: number; cap: number; usedToday: number }> {
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
export async function launchApproved(budget: number, maxPerRun: number): Promise<{ launched: number; errors: string[] }> {
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
export async function launchWebsiteFills(): Promise<{ launched: number; errors: string[] }> {
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
export async function followUps(): Promise<{ followupsDrafted: number; ghosted: number }> {
  const out = { followupsDrafted: 0, ghosted: 0 };
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString().split('T')[0];

  const { data: active } = await supabaseServer
    .from('job_applications')
    .select('*')
    .in('status', ['applied', 'screening'])
    .or(`last_activity_date.lte.${daysAgo(7)},and(last_activity_date.is.null,applied_date.lte.${daysAgo(7)})`);

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



/** STEP E — daily LinkedIn DM sweep (answers recruiter DMs directly, no drafts).
 * Runs at most once per day, gated by ENABLE_DM_SWEEP. Started sweeps are
 * tracked in system_health (fallback_used carries the session id) and
 * finalized on the next executor tick: every reply lands in the dashboard.
 */
export async function dmSweep(): Promise<{ started: boolean; finalizedReplies: number }> {
  const out = { started: false, finalizedReplies: 0 };
  if (process.env.ENABLE_DM_SWEEP !== 'true') return out;

  const todayIso = new Date().toISOString().split('T')[0];

  // Finalize any sweep started today
  const { data: startedRows } = await supabaseServer
    .from('system_health')
    .select('id, fallback_used, operation')
    .eq('source', 'dm_sweep')
    .eq('operation', 'sweep_started')
    .gte('created_at', todayIso);

  for (const row of startedRows || []) {
    if (!row.fallback_used) continue;
    const { done, output } = await getSessionOutput(row.fallback_used);
    if (!done) continue;

    const conversations = (output as { conversations?: Array<Record<string, string>> } | null)?.conversations || [];
    for (const convo of conversations) {
      await supabaseServer.from('triage_items').insert({
        title: `DM ${convo.reply_sent ? 'answered' : 'reviewed'}: ${convo.sender || 'unknown'}`,
        subtitle: convo.summary || '',
        source: 'linkedin_dm',
        category: convo.classification === 'recruiter' || convo.classification?.includes('opportunit') ? 'urgent' : 'review',
        priority: convo.reply_sent ? 6 : 4,
        tags: ['dm-sweep', convo.classification || 'unknown'],
        draft_reply: convo.reply_sent || null,
        contact_name: convo.sender || null,
        contact_url: 'https://www.linkedin.com/messaging/',
        triage_date: todayIso,
        notes: convo.reply_sent ? `Replied automatically: "${(convo.reply_sent || '').slice(0, 300)}"` : 'No reply needed',
        action_status: null,
      });
      out.finalizedReplies++;
    }

    await supabaseServer.from('system_health').update({ operation: 'sweep_finalized', items_count: conversations.length }).eq('id', row.id);
  }

  // Start today's sweep if none exists yet (one per day)
  const alreadyToday = (startedRows || []).length > 0;
  const { data: finalizedToday } = await supabaseServer
    .from('system_health')
    .select('id')
    .eq('source', 'dm_sweep')
    .gte('created_at', todayIso)
    .limit(1);

  if (!alreadyToday && (!finalizedToday || finalizedToday.length === 0)) {
    const result = await createDmSweepSession();
    if (result.status === 'queued') {
      await supabaseServer.from('system_health').insert({
        cron_run_id: crypto.randomUUID(),
        source: 'dm_sweep',
        operation: 'sweep_started',
        status: 'ok',
        items_count: 0,
        duration_ms: 0,
        fallback_used: result.sessionId,
      });
      out.started = true;
    } else if (result.status !== 'not_configured') {
      await logHealth('dm_sweep', 'sweep_start', 'error', 0, 0, result.message);
    }
  }

  return out;
}

export interface ExecutorSummary {
  finalized: { executed: number; failed: number; stillRunning: number; readyToSend: number };
  pacing: { remaining: number; cap: number; usedToday: number; maxPerRun: number; jitterSkipped: boolean };
  launch: { launched: number; errors: string[] };
  websiteFills: { launched: number; errors: string[] };
  followup: { followupsDrafted: number; ghosted: number };
  dm: { started: boolean; finalizedReplies: number };
  duration_ms: number;
}

export async function runExecutor(opts: { jitterSkip: boolean }): Promise<ExecutorSummary> {
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

  // E. Daily LinkedIn DM sweep (answers recruiter DMs directly)
  const dm = await dmSweep();

  const summary: ExecutorSummary = {
    finalized,
    pacing: { ...budget, maxPerRun, jitterSkipped: skipped },
    launch,
    websiteFills,
    followup,
    dm,
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

/** Launch a specific approved Easy Apply item (Run-now / manual batch). */
export async function launchSingleEasyApply(id: string): Promise<{ ok: boolean; error?: string; sessionId?: string; liveUrl?: string | null; status?: number }> {
  const { data: item } = await supabaseServer
    .from('triage_items')
    .select('*')
    .eq('id', id)
    .single();

  if (!item || item.action_status !== 'approved' || item.action_type !== 'apply_job_easy') {
    return { ok: false, error: 'Item is not an approved Easy Apply action', status: 400 };
  }

  const budget = await remainingBudget();
  if (budget.remaining <= 0) {
    return { ok: false, error: `Daily cap reached (${budget.usedToday}/${budget.cap}). Protecting your LinkedIn account — try tomorrow.`, status: 429 };
  }

  const payload = (item.action_payload || {}) as ActionPayload;
  const result = await createEasyApplySession({
    jobUrl: payload.job_url || item.source_url || '',
    jobTitle: item.role_title || item.title || '',
    company: item.company || '',
    coverLetter: item.cover_letter || null,
  });

  if (result.status !== 'queued') {
    return { ok: false, error: result.message, status: 502 };
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

  return { ok: true, sessionId: result.sessionId, liveUrl: result.liveUrl };
}

