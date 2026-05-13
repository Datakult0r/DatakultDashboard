import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { executeEasyApply, executeWebsiteApply } from '@/lib/browser-use';
import type { ActionPayload } from '@/types/triage';

/**
 * POST /api/actions/apply
 * Execute job apply via Browser Use Cloud for approved triage_items.
 * Body: { ids: string[] } — array of triage item IDs to apply for
 *
 * Accepts BOTH action_type='apply_job_easy' AND action_type='apply_job_website'.
 *   - apply_job_easy   → executeEasyApply   (LinkedIn Easy Apply instructions)
 *   - apply_job_website → executeWebsiteApply (generic ATS form instructions)
 *
 * Items are bucketed by action_type and each bucket is submitted in its own
 * batch so the Browser Use auth verification happens once per bucket. Each
 * bucket independently respects Browser Use's 5-task limit + 30-90s waits.
 *
 * State machine: approved → executing → executed | failed
 * On success, a row is also inserted into job_applications.
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty ids array' }, { status: 400 });
    }

    // Fetch approved apply items (both easy + website)
    const { data: items, error: fetchError } = await supabaseServer
      .from('triage_items')
      .select('*')
      .in('id', ids)
      .eq('action_status', 'approved')
      .in('action_type', ['apply_job_easy', 'apply_job_website']);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No approved apply_job_easy / apply_job_website items found' },
        { status: 404 },
      );
    }

    // Mark all as executing up front so the UI reflects intent immediately
    await supabaseServer
      .from('triage_items')
      .update({ action_status: 'executing', updated_at: new Date().toISOString() })
      .in('id', items.map((i) => i.id));

    // Bucket by apply type so each executor sees a homogeneous batch
    const easyItems = items.filter((i) => i.action_type === 'apply_job_easy');
    const webItems = items.filter((i) => i.action_type === 'apply_job_website');

    const toTask = (item: typeof items[number]) => {
      const payload = (item.action_payload || {}) as ActionPayload;
      return {
        jobUrl: payload.job_url || item.source_url || '',
        jobTitle: item.role_title || item.title || '',
        company: item.company || '',
        coverLetter: item.cover_letter || null,
      };
    };

    const [easyResult, webResult] = await Promise.all([
      easyItems.length > 0
        ? executeEasyApply(easyItems.map(toTask))
        : Promise.resolve({ results: [], durationMs: 0, error: null, authOk: true } as const),
      webItems.length > 0
        ? executeWebsiteApply(webItems.map(toTask))
        : Promise.resolve({ results: [], durationMs: 0, error: null, authOk: true } as const),
    ]);

    // Reconcile results back to triage_items + job_applications
    const reconcile = async (
      batchItems: typeof items,
      batchResults: typeof easyResult.results,
      method: 'easy_apply' | 'website',
    ) => {
      for (let i = 0; i < batchResults.length; i++) {
        const r = batchResults[i];
        const item = batchItems[i];
        if (!item) continue;

        const newStatus =
          r.status === 'no_credits'
            ? ('failed' as const)
            : r.status === 'completed' || r.status === 'queued'
              ? ('executed' as const)
              : ('failed' as const);

        const nowIso = new Date().toISOString();
        const payload = (item.action_payload || {}) as ActionPayload;

        await supabaseServer
          .from('triage_items')
          .update({
            action_status: newStatus,
            notes: r.message,
            action_payload: {
              ...payload,
              browser_use_session_id: r.taskId || null,
              sent_at: newStatus === 'executed' ? nowIso : null,
              last_attempt_at: nowIso,
              last_attempt_reason: r.message,
            },
            last_follow_up_at: newStatus === 'executed' ? nowIso : payload?.last_follow_up_at ?? null,
            updated_at: nowIso,
          })
          .eq('id', item.id);

        if (newStatus === 'executed') {
          await supabaseServer.from('job_applications').insert({
            company: item.company || '',
            role: item.role_title || item.title || '',
            job_url: item.source_url || '',
            location: item.location || '',
            salary_range: item.salary_range || '',
            job_type: item.job_type || '',
            method,
            status: 'applied',
            applied_date: new Date().toISOString().split('T')[0],
            cover_letter: item.cover_letter || '',
            tailored_cv_notes: item.tailored_cv_notes || '',
            source_triage_id: item.id,
            score: item.score || 0,
            score_label: item.score_label || null,
          });
        }
      }
    };

    await reconcile(easyItems, easyResult.results, 'easy_apply');
    await reconcile(webItems, webResult.results, 'website');

    const allResults = [...easyResult.results, ...webResult.results];

    return NextResponse.json({
      success: true,
      authOk: easyResult.authOk && webResult.authOk,
      buckets: { easy_apply: easyItems.length, website: webItems.length },
      applied: allResults.filter((r) => r.status === 'completed' || r.status === 'queued').length,
      failed: allResults.filter((r) => r.status === 'failed').length,
      noCredits: allResults.filter((r) => r.status === 'no_credits').length,
      unauthorized: allResults.filter((r) => r.status === 'unauthorized').length,
      results: allResults,
    });
  } catch (err) {
    console.error('Apply error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
