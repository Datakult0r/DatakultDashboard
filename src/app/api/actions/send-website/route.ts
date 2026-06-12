import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { dispatchFollowUp, getSessionStatus, stopSession, createWebsiteApplySession } from '@/lib/browser-use';

/**
 * POST /api/actions/send-website
 * Body: { id: string }
 *
 * The "Send" button for fill-then-hold website applications.
 * A cheap Browser Use agent already filled the entire form and stopped at the
 * final submit button (session kept alive). Philippe reviewed it (liveUrl) and
 * clicked Send — this dispatches the final click to the SAME session, waits
 * for confirmation, and only then records the application as applied.
 */
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

    const { data: item } = await supabaseServer
      .from('triage_items')
      .select('*')
      .eq('id', id)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const payload = (item.action_payload || {}) as Record<string, string | undefined>;
    const sessionId = payload.browser_use_session_id;

    if (!sessionId || !['true', 'expired'].includes(payload.ready_to_send || '')) {
      return NextResponse.json({ error: 'Item is not in ready-to-send state' }, { status: 400 });
    }

    const dispatch = await dispatchFollowUp(
      sessionId,
      'The job application form on the current page is fully filled and at the final review/submit step. Click the final Submit/Send application button now, wait for the confirmation page or message, and finish with submitted=true. If submission fails or an error appears, finish with submitted=false and describe it in reason.'
    );

    let activeSessionId = dispatch.sessionId;
    if (dispatch.status !== 'queued') {
      // Held session likely expired. Philippe already clicked Send, so consent
      // is explicit: start a fresh session that fills AND submits in one go.
      const refill = await createWebsiteApplySession({
        careerUrl: payload.company_career_url || item.contact_url || '',
        jobTitle: item.role_title || item.title || '',
        company: item.company || '',
        coverLetter: item.cover_letter || null,
        cvNotes: item.tailored_cv_notes || null,
      });
      if (refill.status !== 'queued') {
        return NextResponse.json({ error: `Held session expired and refill failed: ${refill.message}` }, { status: 502 });
      }
      // Override the hold instruction: this run should submit at the end.
      await dispatchFollowUp(refill.sessionId,
        'Continue the application you are filling. When you reach the final review/submit step, CLICK SUBMIT (the human already approved sending), wait for confirmation, and finish with submitted=true.');
      activeSessionId = refill.sessionId;
      await supabaseServer.from('triage_items').update({
        action_payload: { ...payload, browser_use_session_id: refill.sessionId, browser_use_live_url: refill.liveUrl || '' },
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }

    await supabaseServer.from('triage_items').update({
      action_status: 'executing',
      notes: 'Submitting…',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Poll up to ~2 minutes for the confirmation
    const today = new Date().toISOString().split('T')[0];
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const session = await getSessionStatus(activeSessionId);
      if (!session.done && session.status !== 'idle') continue;

      if (session.submitted) {
        await supabaseServer.from('triage_items').update({
          action_status: 'executed',
          notes: `Application submitted ✓ (confirmed). Cost $${session.costUsd ?? '?'}`,
          updated_at: new Date().toISOString(),
        }).eq('id', id);

        await supabaseServer.from('job_applications').insert({
          company: item.company || '',
          role: item.role_title || item.title || '',
          job_url: item.source_url || '',
          location: item.location || '',
          salary_range: item.salary_range || '',
          job_type: item.job_type || '',
          method: 'website',
          status: 'applied',
          applied_date: today,
          last_activity_date: today,
          cover_letter: item.cover_letter || '',
          tailored_cv_notes: item.tailored_cv_notes || '',
          contact_url: payload.company_career_url || item.contact_url || '',
          source_triage_id: item.id,
          score: item.score || 0,
          score_label: item.score_label || null,
        });

        await stopSession(activeSessionId); // flush + free the session
        return NextResponse.json({ success: true, submitted: true });
      }

      if (session.done) {
        await supabaseServer.from('triage_items').update({
          action_status: 'failed',
          notes: `Submit failed: ${session.detail || session.status}`,
          updated_at: new Date().toISOString(),
        }).eq('id', id);
        return NextResponse.json({ success: false, submitted: false, detail: session.detail });
      }
    }

    // Timed out waiting — the executor cron will finalize it
    return NextResponse.json({ success: true, submitted: false, pending: true, message: 'Still submitting — the executor will confirm it shortly.' });
  } catch (err) {
    console.error('Send-website error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
