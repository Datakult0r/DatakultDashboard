import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/outbound — list recent outbound entries (last 14 days). */
export async function GET() {
  try {
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
    const { data, error } = await supabaseServer
      .from('outbound_log')
      .select('*')
      .gte('log_date', cutoff)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

/** POST /api/outbound — log an outbound prospecting touch. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = await supabaseServer
      .from('outbound_log')
      .insert({
        contact_name: body.contact_name ?? null,
        contact_url: body.contact_url ?? null,
        channel: body.channel ?? null,
        context: body.context ?? null,
        result: body.result ?? null,
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
