/**
 * GET /api/bumps/discover  (Vercel cron, weekly Mondays 07:00 UTC = 08:00 Lisbon)
 *
 * Scrapes ~50 fresh pain-points from Reddit and stores them in the bumps table.
 * Idempotent — UNIQUE(reddit_id) prevents dupes across runs.
 * Classifying with Claude is a separate step (/api/bumps/classify).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { discoverPainPoints } from '@/lib/reddit-pain-finder';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function logHealth(source: string, op: string, status: 'ok'|'error'|'fallback'|'skipped',
  itemsCount: number, durationMs: number, errorMessage?: string, fallback?: string) {
  try {
    await supabaseServer.from('system_health').insert({
      source, operation: op, status,
      items_count: itemsCount, duration_ms: durationMs,
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
  const result = await discoverPainPoints({ maxResults: 50, timeframe: 'week' });

  if (result.error) {
    await logHealth('reddit_pain_finder', 'discover_bumps', 'error', 0, result.durationMs, result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  if (result.items.length === 0) {
    await logHealth('reddit_pain_finder', 'discover_bumps', 'ok', 0, result.durationMs, undefined, 'empty_result');
    return NextResponse.json({ ok: true, discovered: 0 });
  }

  const rows = result.items.map((p) => ({
    reddit_id: p.redditId,
    title: p.title,
    body: p.body?.slice(0, 4000) ?? null,
    url: p.url,
    subreddit: p.subreddit,
    author: p.author,
    posted_at: p.postedAt,
    upvotes: p.upvotes,
    comments_count: p.commentsCount,
    pain_type: p.painType,
    priority_score: p.priorityScore,
    matched_phrases: p.matchedPhrases,
  }));

  // Idempotent upsert keyed by reddit_id
  const { data, error } = await supabaseServer
    .from('bumps')
    .upsert(rows, { onConflict: 'reddit_id', ignoreDuplicates: true })
    .select('id');

  if (error) {
    await logHealth('reddit_pain_finder', 'discover_bumps', 'error', 0, Date.now() - start, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const inserted = data?.length ?? 0;
  await logHealth('reddit_pain_finder', 'discover_bumps', 'ok', inserted, Date.now() - start);
  return NextResponse.json({ ok: true, scraped: result.items.length, inserted });
}
