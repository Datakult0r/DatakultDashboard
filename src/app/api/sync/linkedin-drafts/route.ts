import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * /api/sync/linkedin-drafts
 *
 * Bridge between the local Cowork session that scans Beeper LinkedIn DMs and
 * the dashboard. Vercel can't reach your laptop, so the local session does
 * the Beeper MCP work and then calls this endpoint to mirror state into Supabase.
 *
 * GET  — list DMs already in Supabase (used by the local sync to dedup)
 * POST — body: { drafts: BeeperDraft[] } — upsert into triage_items
 *
 * BeeperDraft shape (each one):
 *   chat_id           string  — Beeper chat ID, used as source_url for idempotency
 *   contact_name      string
 *   contact_url       string  — LinkedIn profile URL (optional)
 *   their_message     string  — the inbound message we're replying to
 *   draft_reply       string  — the AI-generated draft Claude produced
 *   priority          1-10
 *   score_label       'strong' | 'apply' | 'light' | 'skip' | 'priority'
 *   tags              string[]
 *   already_drafted   boolean — true if Beeper already has the draft saved (via send_message_draft)
 */

interface BeeperDraft {
  chat_id: string;
  contact_name: string;
  contact_url?: string;
  their_message?: string;
  draft_reply: string;
  priority?: number;
  score_label?: 'strong' | 'apply' | 'light' | 'skip' | 'priority';
  tags?: string[];
  already_drafted?: boolean;
}

/** GET — return today's linkedin_dm items so the local sync can dedup. */
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseServer
      .from('triage_items')
      .select('id, title, contact_name, contact_url, source_url, action_status, draft_reply, action_payload')
      .eq('source', 'linkedin_dm')
      .gte('triage_date', today)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

/** POST — upsert a batch of LinkedIn DM drafts produced locally via Beeper MCP. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const drafts: BeeperDraft[] = Array.isArray(body.drafts) ? body.drafts : [];
    if (drafts.length === 0) return NextResponse.json({ error: 'drafts array is empty' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const d of drafts) {
      if (!d.chat_id || !d.draft_reply) {
        skipped++;
        continue;
      }
      // The unique partial index is on (source, source_url, triage_date) where source_url is not null.
      // We use chat_id as source_url so re-running the local sync on the same day is idempotent.
      const row = {
        title: d.contact_name ? `${d.contact_name} — LinkedIn DM` : 'LinkedIn DM',
        subtitle: d.their_message?.slice(0, 200) ?? null,
        source: 'linkedin_dm',
        source_url: d.chat_id,
        category: 'review' as const,
        score: 0,
        score_label: d.score_label ?? null,
        priority: d.priority ?? 5,
        tags: d.tags ?? [],
        contact_name: d.contact_name,
        contact_url: d.contact_url ?? null,
        draft_reply: d.draft_reply,
        triage_date: today,
        action_type: 'send_message' as const,
        action_payload: { chat_id: d.chat_id, message_text: d.draft_reply },
        action_status: d.already_drafted ? 'approved' : 'pending_review',
      };

      // Try insert; if duplicate, update.
      const { error: insertErr } = await supabaseServer.from('triage_items').insert(row);
      if (!insertErr) {
        inserted++;
        continue;
      }
      if (insertErr.message?.includes('duplicate key') || insertErr.code === '23505') {
        const { error: updateErr } = await supabaseServer
          .from('triage_items')
          .update({
            draft_reply: d.draft_reply,
            action_payload: row.action_payload,
            priority: row.priority,
            score_label: row.score_label,
            updated_at: new Date().toISOString(),
          })
          .eq('source', 'linkedin_dm')
          .eq('source_url', d.chat_id)
          .eq('triage_date', today);
        if (updateErr) errors.push(`${d.chat_id}: ${updateErr.message}`);
        else updated++;
      } else {
        errors.push(`${d.chat_id}: ${insertErr.message}`);
      }
    }

    return NextResponse.json({ inserted, updated, skipped, errors });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
