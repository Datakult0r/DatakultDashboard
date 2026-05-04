/**
 * POST /api/jobs/easy-apply  { jobId: string }
 *
 * Manually queues one STRONG_APPLY job for Browser Use Easy Apply.
 * Reads the job from philippe_jobs, calls executeEasyApply with its tailored cover letter,
 * stores the resulting browser_use_session_id (taskId) back on the row.
 *
 * Auto-apply is intentionally NOT wired into the daily cron — submissions need user consent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { executeEasyApply } from '@/lib/browser-use';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { jobId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { jobId } = body;
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  // Load the job
  const { data: job, error } = await supabaseServer
    .from('philippe_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: error?.message ?? 'Job not found' }, { status: 404 });
  }
  if (job.decision !== 'STRONG_APPLY') {
    return NextResponse.json({ error: 'Only STRONG_APPLY jobs auto-apply' }, { status: 400 });
  }
  if (job.apply_type !== 'easy_apply') {
    return NextResponse.json({ error: 'Only easy_apply jobs supported here' }, { status: 400 });
  }
  if (!job.cover_note) {
    return NextResponse.json({ error: 'No cover letter — re-run scoring first' }, { status: 400 });
  }
  if (!job.job_url) {
    return NextResponse.json({ error: 'No job URL on record' }, { status: 400 });
  }

  // Mark as APPLYING immediately so the UI reflects intent
  await supabaseServer
    .from('philippe_jobs')
    .update({ apply_status: 'APPLYING' })
    .eq('id', jobId);

  const result = await executeEasyApply([
    {
      jobUrl: job.job_url,
      jobTitle: job.title,
      company: job.company,
      coverLetter: job.cover_note,
    },
  ]);

  const r0 = result.results?.[0];
  const ok = Boolean(r0 && (r0.status === 'completed' || r0.status === 'queued'));
  const taskId = r0?.taskId ?? null;

  await supabaseServer
    .from('philippe_jobs')
    .update({
      apply_status: ok ? 'APPLIED' : 'FAILED',
      apply_reason: r0?.message ?? result.error ?? null,
      browser_use_session_id: taskId,
    })
    .eq('id', jobId);

  return NextResponse.json({
    ok,
    jobId,
    sessionId: taskId,
    status: r0?.status ?? null,
    message: r0?.message ?? null,
    authOk: result.authOk,
  });
}
