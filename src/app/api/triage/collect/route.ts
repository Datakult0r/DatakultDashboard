import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { fetchUnreadEmails } from '@/lib/gmail';
import { scoreEmails } from '@/lib/scoring';

/**
 * Maximum duration for Vercel serverless function (seconds).
 * Pro plan: 300s, Hobby: 60s. Gmail + Claude scoring needs ~30-60s.
 */
export const maxDuration = 120;

/**
 * GET /api/triage/collect
 *
 * Automated morning triage data collection:
 * 1. Fetches unread Gmail messages (last 24h)
 * 2. Scores them using Claude API
 * 3. Writes results to Supabase triage_items
 * 4. Cleans up items older than 14 days
 *
 * Protected by CRON_SECRET header check.
 * Called by Vercel cron at 9:00 AM daily.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    gmailFetched: 0,
    gmailScored: 0,
    supabaseInserted: 0,
    supabaseCleaned: 0,
    errors: [] as string[],
  };

  try {
    // ── Step 1: Clean up old items (14-day retention) ──
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: cleaned } = await supabaseServer
      .from('triage_items')
      .delete()
      .lt('triage_date', fourteenDaysAgo)
      .select('id');

    results.supabaseCleaned = cleaned?.length || 0;
  } catch (err) {
    results.errors.push(`Cleanup error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Step 2: Fetch Gmail ──
  try {
    const emails = await fetchUnreadEmails();
    results.gmailFetched = emails.length;

    if (emails.length > 0) {
      // ── Step 3: Score with Claude ──
      const scored = await scoreEmails(emails);
      results.gmailScored = scored.length;

      // ── Step 4: Write to Supabase ──
      const triageItems = scored.map((item) => ({
        title: item.subject || `Email from ${item.contactName}`,
        subtitle: item.snippet,
        source: 'email' as const,
        category: item.category,
        score: item.score,
        score_label: item.scoreLabel,
        priority: item.priority,
        tags: item.tags,
        draft_reply: item.draftReply,
        contact_name: item.contactName,
        contact_url: `https://mail.google.com/mail/u/0/#inbox/${item.messageId}`,
        triage_date: new Date().toISOString().split('T')[0],
        action_type: item.draftReply ? 'reply_email' as const : null,
        action_payload: item.draftReply
          ? {
              email_to: item.from,
              email_subject: `Re: ${item.subject}`,
              email_body: item.draftReply,
            }
          : {},
        action_status: item.draftReply ? 'pending_review' as const : null,
      }));

      if (triageItems.length > 0) {
        const { data, error } = await supabaseServer
          .from('triage_items')
          .insert(triageItems)
          .select('id');

        if (error) {
          results.errors.push(`Supabase insert error: ${error.message}`);
        } else {
          results.supabaseInserted = data?.length || 0;
        }
      }
    }
  } catch (err) {
    results.errors.push(`Gmail/scoring error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const duration = Date.now() - startTime;

  return NextResponse.json({
    success: results.errors.length === 0,
    duration_ms: duration,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
