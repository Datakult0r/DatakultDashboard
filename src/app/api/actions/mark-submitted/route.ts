import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * POST /api/actions/mark-submitted
 * Body: { id: string }
 *
 * The single source of truth for "this application was really sent".
 * Called when Philippe confirms he submitted a website application (one click
 * in the dashboard). Marks the triage item executed and creates the
 * job_applications pipeline row with an accurate applied_date.
 */
export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

    const { data: item, error: fetchError } = await supabaseServer
      .from('triage_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.action_status === 'executed') {
      return NextResponse.json({ success: true, alreadyDone: true });
    }

    const today = new Date().toISOString().split('T')[0];

    await supabaseServer
      .from('triage_items')
      .update({
        action_status: 'executed',
        notes: `Submitted by Philippe on ${today} ✓`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    const { data: app, error: insertError } = await supabaseServer
      .from('job_applications')
      .insert({
        company: item.company || '',
        role: item.role_title || item.title || '',
        job_url: item.source_url || '',
        location: item.location || '',
        salary_range: item.salary_range || '',
        job_type: item.job_type || '',
        method: item.action_type === 'apply_job_easy' ? 'easy_apply' : 'website',
        status: 'applied',
        applied_date: today,
        last_activity_date: today,
        cover_letter: item.cover_letter || '',
        tailored_cv_notes: item.tailored_cv_notes || '',
        contact_url: item.contact_url || '',
        source_triage_id: item.id,
        score: item.score || 0,
        score_label: item.score_label || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, application: app });
  } catch (err) {
    console.error('Mark-submitted error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
