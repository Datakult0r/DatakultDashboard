import { NextRequest, NextResponse } from 'next/server';
import { runExecutor, launchSingleEasyApply, finalizeExecuting } from '@/lib/executor';

/**
 * /api/actions/execute — the execution engine entrypoint that was missing.
 *
 * Before this existed, "Approve" only flipped action_status to 'approved' and
 * NOTHING ever picked those items up: no cron, no UI call. Approved items aged
 * into SLA breaches forever. The engine itself lives in src/lib/executor.ts.
 *
 * GET  — Vercel cron, 3x/day at human-irregular minutes, CRON_SECRET-protected.
 * POST {id} — manual "Run now" from the dashboard for one approved item.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const summary = await runExecutor({ jitterSkip: true });
  return NextResponse.json({ success: true, ...summary });
}

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    await finalizeExecuting(); // opportunistic cleanup
    const result = await launchSingleEasyApply(id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    return NextResponse.json({ success: true, sessionId: result.sessionId, liveUrl: result.liveUrl });
  } catch (err) {
    console.error('Manual execute error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
