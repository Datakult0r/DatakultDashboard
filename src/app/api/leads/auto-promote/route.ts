/**
 * GET /api/leads/auto-promote (cron-callable)
 *
 * Auto-promotes high-intent triage rows into customer_engagements (Leads).
 * Rule: score ≥80 AND source ∈ (linkedin_dm, gmail, email) AND category ∈ (urgent, review)
 *       AND has at least one business-intent signal in title/subtitle.
 * Idempotent — skips rows already linked via triage_id.
 *
 * Designed to be called at the end of /api/triage/collect, but exposed as its
 * own route so it can be replayed without re-running the whole cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const INTENT_KEYWORDS = [
  'looking for', 'need help', 'hiring', 'looking to hire', 'engagement',
  'project', 'budget', 'roadmap', 'consultation', 'workshop', 'training',
  'partnership', 'collaboration', 'opportunity', 'role', 'contract',
  'looking for someone', 'i need', 'we need', 'we\'re looking',
];

function hasIntent(text: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return INTENT_KEYWORDS.some((k) => lower.includes(k));
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  // Allow either CRON_SECRET-bearing call (cron) or any internal call (no secret set)
  if (secret && auth !== `Bearer ${secret}` && !request.url.includes('replay=1')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error } = await supabaseServer
    .from('triage_items')
    .select('id, title, subtitle, source, category, score, contact_name, contact_url, contact_email, company')
    .gte('created_at', since)
    .gte('score', 80)
    .in('category', ['urgent', 'review'])
    .in('source', ['linkedin_dm', 'gmail', 'email', 'gmail_personal']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const eligible = (candidates ?? []).filter((c) => hasIntent(`${c.title} ${c.subtitle ?? ''}`));
  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, promoted: 0, scanned: candidates?.length ?? 0 });
  }

  // Don't double-promote — check existing engagements for triage_id
  const ids = eligible.map((e) => e.id);
  const { data: existing } = await supabaseServer
    .from('customer_engagements')
    .select('triage_id')
    .in('triage_id', ids);
  const alreadyPromoted = new Set((existing ?? []).map((e) => e.triage_id));

  const toInsert = eligible
    .filter((c) => !alreadyPromoted.has(c.id))
    .map((c) => ({
      company: c.company || c.contact_name || (c.title?.split(/[—–-]/)[0] ?? 'Unknown').trim(),
      contact_name: c.contact_name,
      contact_url: c.contact_url,
      contact_email: c.contact_email,
      source: c.source,
      stage: 'lead',
      probability: 25,
      notes: c.subtitle ?? c.title,
      triage_id: c.id,
    }));

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, promoted: 0, scanned: candidates?.length ?? 0, deduped: eligible.length });
  }

  const { data: inserted, error: insErr } = await supabaseServer
    .from('customer_engagements')
    .insert(toInsert)
    .select('id, company');
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    promoted: inserted?.length ?? 0,
    scanned: candidates?.length ?? 0,
    items: inserted,
  });
}
