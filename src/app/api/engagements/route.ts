import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/engagements — list all customer engagements (server uses service role to bypass RLS). */
export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('customer_engagements')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

/** POST /api/engagements — create one. Body: partial CustomerEngagement (company required). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.company) return NextResponse.json({ error: 'company is required' }, { status: 400 });
    const { data, error } = await supabaseServer
      .from('customer_engagements')
      .insert({
        company: body.company,
        contact_name: body.contact_name ?? null,
        contact_email: body.contact_email ?? null,
        contact_url: body.contact_url ?? null,
        stage: body.stage ?? 'lead',
        source: body.source ?? null,
        value_eur: body.value_eur ?? null,
        probability: body.probability ?? 25,
        next_step: body.next_step ?? null,
        next_step_at: body.next_step_at ?? null,
        notes: body.notes ?? null,
        tags: body.tags ?? [],
        triage_id: body.triage_id ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
