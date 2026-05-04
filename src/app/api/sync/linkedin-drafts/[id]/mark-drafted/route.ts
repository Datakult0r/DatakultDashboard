import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/sync/linkedin-drafts/[id]/mark-drafted
 *
 * Called by the local Cowork session AFTER it has successfully written the draft
 * into Beeper via send_message_draft. Flips the triage_item to action_status='approved'
 * and stamps tags so the dashboard surface shows "Drafted in Beeper" instead of
 * "Pending review".
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { data: existing } = await supabaseServer
      .from('triage_items')
      .select('tags')
      .eq('id', id)
      .single();
    const existingTags: string[] = (existing?.tags as string[] | null) ?? [];
    const tags = Array.from(new Set([...existingTags, 'drafted-in-beeper']));

    const { error } = await supabaseServer
      .from('triage_items')
      .update({
        action_status: 'approved',
        tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
