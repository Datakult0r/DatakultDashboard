import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { executeEasyApply } from '@/lib/browser-use';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const DEFAULT_CAP = 3;
const MIN_DELAY_MS = 90_000;
const MAX_DELAY_MS = 180_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function logHealth(source: string, operation: string, status: 'ok'|'error'|'skipped'|'fallback',
  itemsCount: number, durationMs: number, errorMessage?: string, fallback?: string) {
  try {
    await supabaseServer.from('system_health').insert({
      source, operation, status, items_count: itemsCount, duration_ms: durationMs,
      error_message: errorMessage ?? null, fallback_used: fallback ?? null,
    });
  } catch {}
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const start = Date.now();
  const cap = Math.max(1, Math.min(10, Number(process.env.AUTO_APPLY_DAILY_CAP ?? DEFAULT_CAP)));

  const since24h = new Date(Date.now() - 24*60*60*1000).toISOString();
  const { data: failures } = await supabaseServer.from('philippe_jobs').select('id')
    .eq('apply_status', 'FAILED').gte('updated_at', since24h).limit(1);
  if (failures && failures.length > 0) {
    await logHealth('browser_use', 'auto_apply', 'skipped', 0, Date.now()-start,
      'Auto-paused: a FAILED in last 24h', 'auto_pause_24h');
    return NextResponse.json({ ok: true, autoApplied: 0, paused: true });
  }

  const since7d = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const { data: queue, error: qErr } = await supabaseServer.from('philippe_jobs').select('*')
    .eq('decision', 'STRONG_APPLY').eq('apply_type', 'easy_apply').eq('apply_status', 'SCORED')
    .not('cover_note', 'is', null).not('job_url', 'is', null).gte('created_at', since7d)
    .order('score', { ascending: false }).order('created_at', { ascending: false }).limit(cap);
  if (qErr) {
    await logHealth('browser_use', 'auto_apply', 'error', 0, Date.now()-start, qErr.message);
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  if (!queue || queue.length === 0) {
    await logHealth('browser_use', 'auto_apply', 'ok', 0, Date.now()-start, undefined, 'queue_empty');
    return NextResponse.json({ ok: true, autoApplied: 0, queue: 0 });
  }

  const results: Array<{ id: string; ok: boolean; reason: string|null; sessionId: string|null }> = [];
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    await supabaseServer.from('philippe_jobs').update({ apply_status: 'APPLYING' }).eq('id', job.id);
    const submitResult = await executeEasyApply([{
      jobUrl: job.job_url!, jobTitle: job.title, company: job.company, coverLetter: job.cover_note,
    }]);
    const r0 = submitResult.results?.[0];
    const ok = Boolean(r0 && (r0.status === 'completed' || r0.status === 'queued'));
    const sessionId = r0?.taskId ?? null;
    const reason = r0?.message ?? submitResult.error ?? null;
    await supabaseServer.from('philippe_jobs').update({
      apply_status: ok ? 'APPLIED' : 'FAILED', apply_reason: reason, browser_use_session_id: sessionId,
    }).eq('id', job.id);
    results.push({ id: job.id, ok, reason, sessionId });
    if (!ok) {
      await logHealth('browser_use', 'auto_apply', 'error', i, Date.now()-start,
        `Halted after FAILED for ${job.company}: ${reason ?? 'unknown'}`, 'halt_on_failure');
      break;
    }
    if (i < queue.length - 1) await sleep(randInt(MIN_DELAY_MS, MAX_DELAY_MS));
  }
  const successCount = results.filter((r) => r.ok).length;
  await logHealth('browser_use', 'auto_apply',
    successCount === queue.length ? 'ok' : 'fallback',
    successCount, Date.now()-start,
    successCount === queue.length ? undefined : `Submitted ${successCount}/${queue.length}`,
    successCount === queue.length ? undefined : 'partial_submit');
  return NextResponse.json({ ok: true, autoApplied: successCount, queueSize: queue.length, cap, results });
}
