import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/triage/run
 *
 * Server-side proxy — calls /api/triage/collect with the CRON_SECRET injected.
 * Lets the dashboard trigger a manual cron run without exposing the secret to
 * the client. Personal tool, so we accept the unauthenticated trigger surface
 * (cost is bounded to ~$0.10 per run; not worth the auth complexity yet).
 */
export async function POST() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }

  // Resolve absolute base URL — Vercel sets VERCEL_URL on serverless
  const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  try {
    const r = await fetch(`${host}/api/triage/collect`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await r.json();
    return NextResponse.json({ ok: r.ok, status: r.status, result: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
