import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { executeEasyApply } from '@/lib/browser-use';
import type { ActionPayload } from '@/types/triage';

/**
 * POST /api/actions/apply
 * Execute Easy Apply via Browser Use Cloud for approved job applications.
 * Body: { ids: string[] } — array of triage item IDs to apply for
 *
 * Only processes items with action_status='approved' and action_type='apply_job_easy'.
 * Updates status to 'executing' → 'executed' or 'failed'.
 *
 * Returns immediately with no_credits status if Browser Use has 0 credits,
 * so the dashboard can show a visible alert.
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty ids array' }, { status: 400 });
    }

    // Fetch approved Easy Apply items
    const { data: items, error: fetchError } = await supabaseServer
      .from('triage_items')
      .select('*')
      .in('id', ids)
      .eq('action_status', 'approved')
      .in('action_type', ['apply_job_easy']);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No approved Easy Apply items found' }, { status: 404 });
    }

    // Mark as executing
    await supabaseServer
      .from('triage_items')
      .update({ action_status: 'executing' })
      .in('id', items.map((i) => i.id));

    // Build Browser Use tasks
    const tasks = items.map((item) => {
      const payload = (item.action_payload || {}) as ActionPayload;
      return {
        jobUrl: payload.job_url || item.source_url || '',
        jobTitle: item.role_title || item.title || '',
        company: item.company || '',
        coverLetter: item.cover_letter || null,
      };
    });

    // Execute
    const result = await executeEasyApply(tasks);

    // Update statuses based on results
    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      const itemId = items[i]?.id;
      if (!itemId) continue;

      const newStatus = r.status === 'no_credits'
        ? 'failed' as const
        : r.status === 'completed' || r.status === 'queued'
          ? 'executed' as const
          : 'failed' as const;

      await supabaseServer
        .from('triage_items')
        .update({
          action_status: newStatus,
          notes: r.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      // If successfully queued/completed, create a job_application record
      if (newStatus === 'executed') {
        await supabaseServer.from('job_applications').insert({
          company: items[i].company || '',
          role: items[i].role_title || items[i].title || '',
          job_url: items[i].source_url || '',
          location: items[i].location || '',
          salary_range: items[i].salary_range || '',
          job_type: items[i].job_type || '',
          method: 'easy_apply',
          status: 'applied',
          applied_date: new Date().toISOString().split('T')[0],
          cover_letter: items[i].cover_letter || '',
          tailored_cv_notes: items[i].tailored_cv_notes || '',
          source_triage_id: itemId,
          score: items[i].score || 0,
          score_label: items[i].score_label || null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      hasCredits: result.hasCredits,
      applied: result.results.filter((r) => r.status === 'completed' || r.status === 'queued').length,
      failed: result.results.filter((r) => r.status === 'failed').length,
      noCredits: result.results.filter((r) => r.status === 'no_credits').length,
      results: result.results,
    });
  } catch (err) {
    console.error('Easy Apply error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
