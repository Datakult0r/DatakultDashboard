import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/finance — list monthly finance rows, latest first. */
export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('monthly_finance')
      .select('*')
      .order('month', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: msg(err) }, { status: 500 });
  }
}

/** POST /api/finance — upsert a month's row. Body: { month, revenue_eur, expenses_eur, notes }. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.month) return NextResponse.json({ error: 'month is required (YYYY-MM-01)' }, { status: 400 });
    const { data, error } = await supabaseServer
      .from('monthly_finance')
      .upsert({
        month: body.month,
        revenue_eur: Number(body.revenue_eur ?? 0),
        expenses_eur: Number(body.expenses_eur ?? 0),
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
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
