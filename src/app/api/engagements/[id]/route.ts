import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_FIELDS = [
  'company', 'contact_name', 'contact_email', 'contact_url',
  'stage', 'source', 'value_eur', 'probability',
  'next_step', 'next_step_at', 'notes', 'tags', 'triage_id',
] as const;

/** PATCH /api/engagements/[id] — update one. Body: partial fields. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of ALLOWED_FIELDS) {
      if (f in body) update[f] = body[f];
    }
    const { data, error } = await supabaseServer
      .from('customer_engagements')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

/** DELETE /api/engagements/[id] — delete one. */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { error } = await supabaseServer.from('customer_engagements').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
