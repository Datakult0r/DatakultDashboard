import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/briefing
 *
 * Chief-of-staff morning briefing — a single-paragraph summary of the last 24h
 * across triage, engagements, outbound, and pipeline movement. Uses Claude
 * (claude-haiku-4-5) so it's fast + cheap (~$0.001/call). Cached for 30 minutes.
 */
let cache: { generatedAt: number; payload: BriefingPayload } | null = null;
const CACHE_MS = 30 * 60 * 1000;

interface BriefingPayload {
  briefing: string;
  generatedAt: string;
  signals: {
    triage_yesterday: number;
    approved_yesterday: number;
    outbound_yesterday: number;
    engagements_active: number;
    engagements_overdue: number;
    sla_breaches: number;
  };
}

export async function GET() {
  if (cache && Date.now() - cache.generatedAt < CACHE_MS) {
    return NextResponse.json({ ...cache.payload, cached: true });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY' }, { status: 500 });

  try {
    // Gather signals
    const yesterdayIso = new Date(Date.now() - 24 * 3600000).toISOString();
    const todayIso = new Date(Date.now() - 0).toISOString();

    const [{ data: triage }, { data: outbound }, { data: engagements }, { data: breaches }] = await Promise.all([
      supabaseServer.from('triage_items')
        .select('title, source, action_status, action_type, priority, score, score_label, contact_name')
        .gte('created_at', yesterdayIso),
      supabaseServer.from('outbound_log')
        .select('contact_name, channel')
        .gte('created_at', yesterdayIso),
      supabaseServer.from('customer_engagements')
        .select('company, stage, value_eur, probability, next_step, next_step_at, updated_at, contact_name'),
      supabaseServer.from('sla_breaches').select('*'),
    ]);

    const signals: BriefingPayload['signals'] = {
      triage_yesterday: triage?.length ?? 0,
      approved_yesterday: (triage ?? []).filter((t) => t.action_status === 'approved').length,
      outbound_yesterday: outbound?.length ?? 0,
      engagements_active: (engagements ?? []).filter((e) => !['won', 'lost', 'paused'].includes(e.stage)).length,
      engagements_overdue: (engagements ?? []).filter(
        (e) => e.next_step_at && e.next_step_at <= todayIso.split('T')[0] && !['won', 'lost', 'paused'].includes(e.stage),
      ).length,
      sla_breaches: breaches?.length ?? 0,
    };

    // Build a tight context for Claude
    const context = JSON.stringify(
      {
        signals,
        sample_triage: (triage ?? []).slice(0, 8).map((t) => ({
          title: t.title?.slice(0, 80),
          source: t.source,
          status: t.action_status,
          priority: t.priority,
          score_label: t.score_label,
          contact: t.contact_name,
        })),
        active_engagements: (engagements ?? [])
          .filter((e) => !['won', 'lost', 'paused'].includes(e.stage))
          .slice(0, 5)
          .map((e) => ({
            company: e.company,
            stage: e.stage,
            next_step: e.next_step,
            next_step_at: e.next_step_at,
            value: e.value_eur,
            prob: e.probability,
          })),
        sla_breaches: (breaches ?? []).slice(0, 5).map((b: { title: string; days_overdue: number }) => ({
          title: b.title,
          days_overdue: b.days_overdue,
        })),
      },
      null,
      0,
    );

    const prompt = `You are Philippe Küng's chief of staff. Write a single tight paragraph (3-5 sentences, max 90 words) summarising the last 24h of his Control Tower activity. Mention the most important specific names/companies if present. End with one concrete suggested action for today.

Tone: warm, efficient, no fluff. Plain prose. No emoji, no markdown, no bullets.

Data:
${context}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: `Claude error: ${err}` }, { status: 502 });
    }
    const data = await r.json();
    const briefing = (data.content?.[0]?.text || '').trim();

    const payload: BriefingPayload = {
      briefing,
      generatedAt: new Date().toISOString(),
      signals,
    };
    cache = { generatedAt: Date.now(), payload };
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
