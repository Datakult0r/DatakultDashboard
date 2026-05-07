import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const VALID = ['discovered', 'researching', 'validated', 'building', 'dropped'] as const;

export async function POST(req: NextRequest) {
  const { id, status, notes } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  if (status && !VALID.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (typeof notes === 'string') patch.notes = notes;
  const { error } = await supabaseServer.from('bumps').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
