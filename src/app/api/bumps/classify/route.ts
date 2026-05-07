/**
 * POST /api/bumps/classify  body: { id?: string }  (optional — if no id, classify all unclassified)
 *
 * For each unclassified bump, asks Claude to score:
 *   - claude_solvability (0-100): how solvable is this with GenAI?
 *   - claude_target_market (string): who would pay for the solution?
 *   - claude_summary (paragraph): summary of the pain
 *   - claude_product_idea (paragraph): a concrete GenAI product that could solve it
 *
 * Cost: ~$0.001 per row (Claude Haiku). 50 rows = $0.05.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface ClassifiedBump {
  claude_solvability: number;
  claude_target_market: string;
  claude_summary: string;
  claude_product_idea: string;
}

const PROMPT = `You evaluate Reddit pain-point posts for an AI agency founder building productized GenAI tools.
Given the post title + body, return ONLY a JSON object with these keys:
- "solvability" (integer 0-100): how solvable is this pain with current GenAI tech (LLMs, agents, RAG)?
- "target_market" (string, max 80 chars): who would pay to have this solved? (e.g. "small SaaS founders", "in-house recruiters")
- "summary" (string, 1-2 sentences): the pain in plain English
- "product_idea" (string, 2-3 sentences): a concrete GenAI product that could solve this — features, hook, pricing model
Return ONLY the JSON, no markdown fences.`;

async function classifyOne(title: string, body: string): Promise<ClassifiedBump | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: `${PROMPT}\n\nTitle: ${title}\n\nBody:\n${body.slice(0, 2000)}` }],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data.content?.[0]?.text ?? '{}';
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const solvability = typeof parsed.solvability === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.solvability))) : 0;
    return {
      claude_solvability: solvability,
      claude_target_market: String(parsed.target_market ?? '').slice(0, 200),
      claude_summary: String(parsed.summary ?? '').slice(0, 500),
      claude_product_idea: String(parsed.product_idea ?? '').slice(0, 1000),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };

  let query = supabaseServer.from('bumps').select('id, title, body').is('claude_solvability', null);
  if (id) query = supabaseServer.from('bumps').select('id, title, body').eq('id', id);
  const { data: rows, error } = await query.limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ ok: true, classified: 0 });

  let classified = 0;
  for (const row of rows) {
    const r = await classifyOne(row.title, row.body ?? '');
    if (!r) continue;
    await supabaseServer.from('bumps').update(r).eq('id', row.id);
    classified += 1;
  }
  return NextResponse.json({ ok: true, classified });
}
