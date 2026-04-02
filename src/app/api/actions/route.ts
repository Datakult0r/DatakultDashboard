import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ActionStatus } from '@/types/triage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ActionRequest {
  /** The triage item ID */
  id: string;
  /** The action to take: approve or reject */
  action: 'approve' | 'reject';
}

/**
 * POST /api/actions — Approve or reject a pending action
 * Sets action_status to 'approved' or 'rejected' on the triage_items row
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ActionRequest;

    if (!body.id || !body.action) {
      return NextResponse.json(
        { error: 'Missing required fields: id and action' },
        { status: 400 }
      );
    }
    if (body.action !== 'approve' && body.action !== 'reject') {
      return NextResponse.json(
        { error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const newStatus: ActionStatus = body.action === 'approve' ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('triage_items')
      .update({
        action_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .eq('action_status', 'pending_review')
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(        { error: 'Item not found or not in pending_review state' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/actions — List all items with pending actions
 */
export async function GET() {
  const { data, error } = await supabase
    .from('triage_items')
    .select('*')
    .neq('action_status', 'none')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}