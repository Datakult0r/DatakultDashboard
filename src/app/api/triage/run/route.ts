import { NextRequest, NextResponse } from 'next/server';
import { GET as collectHandler } from '../collect/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/triage/run
 *
 * In-process invocation of the cron handler with CRON_SECRET injected as Bearer.
 * Avoids HTTP round-trip (which would hit Vercel team SSO on the *.vercel.app URL).
 *
 * Personal tool, single user — we accept the unauthenticated trigger surface
 * because the cost is bounded (~$0.10 per run).
 */
export async function POST() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }

  // Build a synthetic NextRequest with the Authorization header collect/route.ts expects
  const fakeReq = new NextRequest(new URL('http://localhost/api/triage/collect'), {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
  });

  try {
    const response = await collectHandler(fakeReq);
    const data = await response.json();
    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      result: data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
