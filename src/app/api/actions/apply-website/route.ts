import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import type { ActionPayload } from '@/types/triage';

/**
 * POST /api/actions/apply-website
 *
 * HONESTY FIX: this route used to mark items 'executed' and insert a
 * job_applications row with status='applied' even though NOTHING had been
 * submitted — which is why the pipeline showed dozens of "applied" jobs that
 * never got a response. An application that was never sent can't convert.
 *
 * Now it only stages the materials: the item stays 'approved' with a
 * ready_to_submit flag, and shows up in the dashboard's "Your queue" with the
 * career page link, cover letter and CV notes one click away. The pipeline row
 * is created by /api/actions/mark-submitted ONLY when Philippe confirms he
 * actually submitted (or when a future website-automation agent confirms it).
 *
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty ids array' }, { status: 400 });
    }

    const { data: items, error: fetchError } = await supabaseServer
      .from('triage_items')
      .select('*')
      .in('id', ids)
      .eq('action_status', 'approved')
      .eq('action_type', 'apply_job_website');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No approved website-apply items found' }, { status: 404 });
    }

    const results: Array<{ id: string; status: string; careerUrl: string | null }> = [];

    for (const item of items) {
      const payload = (item.action_payload || {}) as ActionPayload;
      const careerUrl = payload.company_career_url || item.contact_url || null;

      await supabaseServer
        .from('triage_items')
        .update({
          action_payload: { ...payload, ready_to_submit: 'true' },
          notes: careerUrl
            ? `Materials ready — submit at: ${careerUrl} (then click "Mark submitted")`
            : 'Materials ready — career page not found, search manually, then click "Mark submitted".',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      results.push({ id: item.id, status: 'materials_ready', careerUrl });
    }

    return NextResponse.json({ success: true, staged: results.length, results });
  } catch (err) {
    console.error('Website apply error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
