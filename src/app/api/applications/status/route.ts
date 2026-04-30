import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

const VALID_STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn'];

/**
 * POST /api/applications/status
 * Updates the status of a job application
 * Body: { id: string, status: ApplicationStatus }
 * Uses server client (service role key) to bypass RLS
 */
export async function POST(request: NextRequest) {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('job_applications')
      .update({
        status,
        last_activity_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating application status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, application: data });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
