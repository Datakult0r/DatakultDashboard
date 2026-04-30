import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import type { ActionPayload } from '@/types/triage';

/**
 * POST /api/actions/apply-website
 * Handles non-LinkedIn website application flow.
 *
 * For website applications, the agent's job is to:
 * 1. Find the career page URL (already done by Firecrawl in the cron)
 * 2. Prepare cover letter + tailored CV notes (already done by scoring + CV tailor)
 * 3. Mark as ready-to-apply with all materials prepared
 *
 * Actual form filling happens via Chrome MCP during agent sessions,
 * NOT via this API route. This route marks the application as "materials ready"
 * and creates the job_application record for pipeline tracking.
 *
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty ids array' }, { status: 400 });
    }

    // Fetch approved website-apply items
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

      // Update triage item status
      await supabaseServer
        .from('triage_items')
        .update({
          action_status: 'executed',
          notes: careerUrl
            ? `Materials prepared. Apply at: ${careerUrl}`
            : 'Materials prepared. Career page URL not found — search manually.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      // Create job application record for pipeline tracking
      await supabaseServer.from('job_applications').insert({
        company: item.company || '',
        role: item.role_title || item.title || '',
        job_url: item.source_url || '',
        location: item.location || '',
        salary_range: item.salary_range || '',
        job_type: item.job_type || '',
        method: 'website',
        status: 'applied',
        applied_date: new Date().toISOString().split('T')[0],
        cover_letter: item.cover_letter || '',
        tailored_cv_notes: item.tailored_cv_notes || '',
        contact_url: careerUrl || '',
        source_triage_id: item.id,
        score: item.score || 0,
        score_label: item.score_label || null,
      });

      results.push({
        id: item.id,
        status: 'executed',
        careerUrl,
      });
    }

    return NextResponse.json({
      success: true,
      applied: results.length,
      results,
    });
  } catch (err) {
    console.error('Website apply error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
