import { NextRequest, NextResponse } from 'next/server';
import { launchSingleEasyApply, finalizeExecuting } from '@/lib/executor';

/**
 * POST /api/actions/apply  (legacy endpoint, kept for compatibility)
 * Body: { ids: string[] }
 *
 * Previously called the dead Browser Use v1 API and marked items 'executed'
 * the moment a task was QUEUED — no verification, no pacing. Now delegates to
 * the shared executor: same daily cap, same persistent profile, and items are
 * only marked applied after the agent confirms submission.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty ids array' }, { status: 400 });
    }

    await finalizeExecuting();

    const results: Array<{ id: string; ok: boolean; error?: string; liveUrl?: string | null }> = [];
    for (const id of ids) {
      const r = await launchSingleEasyApply(String(id));
      results.push({ id: String(id), ok: r.ok, error: r.error, liveUrl: r.liveUrl });
      if (!r.ok && r.status === 429) break; // cap reached — stop the batch
    }

    return NextResponse.json({
      success: true,
      launched: results.filter((r) => r.ok).length,
      results,
    });
  } catch (err) {
    console.error('Easy Apply error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
