import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { fetchUnreadEmails } from '@/lib/gmail';
import { scoreEmails } from '@/lib/scoring';
import { fetchCalendarEvents } from '@/lib/calendar';
import { discoverJobs } from '@/lib/apify';
import { scoreJobs } from '@/lib/job-scoring';
import { tailorCVForJobs } from '@/lib/cv-tailor';
import { scrapeIntelligence, scrapeCareerPage } from '@/lib/firecrawl';
import { fetchPerplexityNews } from '@/lib/perplexity';
import { generateContentDrafts } from '@/lib/content-engine';

/**
 * Maximum duration for Vercel serverless function (seconds).
 * Pro plan allows 300s. Full pipeline: Gmail + Apify + Firecrawl + Claude scoring + content = ~120-240s.
 */
export const maxDuration = 300;

/** Generate a unique ID for this cron run to group health logs */
function cronRunId(): string {
  return crypto.randomUUID();
}

/** Log a tool execution to system_health */
async function logHealth(
  runId: string,
  source: string,
  operation: string,
  status: 'ok' | 'error' | 'fallback' | 'skipped' | 'timeout',
  itemsCount: number,
  durationMs: number,
  errorMessage?: string,
  fallbackUsed?: string
): Promise<void> {
  try {
    await supabaseServer.from('system_health').insert({
      cron_run_id: runId,
      source,
      operation,
      status,
      items_count: itemsCount,
      duration_ms: durationMs,
      error_message: errorMessage || null,
      fallback_used: fallbackUsed || null,
    });
  } catch {
    // Health logging should never break the pipeline
    console.error(`Failed to log health: ${source}/${operation}`);
  }
}

/**
 * GET /api/triage/collect
 *
 * Situation Room — automated morning intelligence pipeline:
 *
 * STEP 0: Cleanup (14-day retention on triage_items, 30-day on system_health)
 * STEP 1: Gmail — fetch unread, score with Claude, draft replies
 * STEP 2: Apify — discover GenAI remote jobs (public scraping, no login)
 * STEP 3: Claude — score jobs (0-100 rubric), generate cover letters for >=65
 * STEP 4: Firecrawl — scrape news sources + events + Nate's Substack
 * STEP 5: Claude — generate thought leadership content drafts
 * STEP 6: Career pages — find direct apply URLs for top jobs (avoid LinkedIn apply)
 *
 * Each step is independent with try/catch. Failures are logged to system_health
 * but never block the pipeline. Every source logs its result.
 *
 * Protected by CRON_SECRET. Called by Vercel cron at 9:00 AM UTC daily.
 */
export async function GET(request: NextRequest) {
  // ── Auth ──
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = cronRunId();
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];

  const results = {
    cron_run_id: runId,
    gmail: { fetched: 0, scored: 0, inserted: 0 },
    calendar: { fetched: 0, inserted: 0 },
    jobs: { discovered: 0, scored: 0, strong: 0, coverLetters: 0, cvTailored: 0, inserted: 0 },
    perplexityNews: { fetched: 0, inserted: 0 },
    firecrawlNews: { scraped: 0, inserted: 0 },
    content: { drafts: 0, inserted: 0 },
    cleanup: { triageRemoved: 0, healthRemoved: 0 },
    errors: [] as string[],
  };

  // ══════════════════════════════════════════
  // STEP 0: CLEANUP
  // ══════════════════════════════════════════
  try {
    // 21-day retention (3-week pipeline window)
    // NEVER delete items that are pending_review or approved — those stay forever
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: cleaned } = await supabaseServer
      .from('triage_items')
      .delete()
      .lt('triage_date', twentyOneDaysAgo)
      .not('action_status', 'in', '("pending_review","approved")')
      .select('id');
    results.cleanup.triageRemoved = cleaned?.length || 0;

    // 30-day retention on system_health
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: healthCleaned } = await supabaseServer
      .from('system_health')
      .delete()
      .lt('created_at', thirtyDaysAgo)
      .select('id');
    results.cleanup.healthRemoved = healthCleaned?.length || 0;
  } catch (err) {
    results.errors.push(`Cleanup: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ══════════════════════════════════════════
  // STEP 1: GMAIL (existing pipeline)
  // ══════════════════════════════════════════
  const gmailStart = Date.now();
  try {
    const emails = await fetchUnreadEmails();
    results.gmail.fetched = emails.length;

    if (emails.length > 0) {
      const scored = await scoreEmails(emails);
      results.gmail.scored = scored.length;

      const triageItems = scored.map((item, idx) => ({
        title: item.subject || `Email from ${item.contactName}`,
        subtitle: item.snippet,
        source: emails[idx]?.account === 'personal' ? 'gmail_personal' : 'email',
        category: item.category,
        score: item.score,
        score_label: item.scoreLabel,
        priority: item.priority,
        tags: item.tags,
        draft_reply: item.draftReply,
        contact_name: item.contactName,
        contact_url: `https://mail.google.com/mail/u/0/#inbox/${item.messageId}`,
        triage_date: today,
        action_type: item.draftReply ? 'reply_email' : null,
        action_payload: item.draftReply
          ? { email_to: item.from, email_subject: `Re: ${item.subject}`, email_body: item.draftReply }
          : {},
        action_status: item.draftReply ? 'pending_review' : null,
      }));

      if (triageItems.length > 0) {
        const { data, error } = await supabaseServer
          .from('triage_items')
          .insert(triageItems)
          .select('id');
        if (error) throw new Error(error.message);
        results.gmail.inserted = data?.length || 0;
      }
    }

    await logHealth(runId, 'gmail', 'fetch_and_score', 'ok', results.gmail.fetched, Date.now() - gmailStart);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Gmail: ${msg}`);
    await logHealth(runId, 'gmail', 'fetch_and_score', 'error', 0, Date.now() - gmailStart, msg);
  }

  // ══════════════════════════════════════════
  // STEP 1.5: GOOGLE CALENDAR
  // ══════════════════════════════════════════
  const calendarStart = Date.now();
  try {
    const calendarResult = await fetchCalendarEvents();
    results.calendar.fetched = calendarResult.events.length;

    if (calendarResult.error) {
      await logHealth(runId, 'calendar', 'fetch_events',
        calendarResult.events.length > 0 ? 'ok' : 'error',
        calendarResult.events.length, calendarResult.durationMs, calendarResult.error);
    } else {
      await logHealth(runId, 'calendar', 'fetch_events', 'ok', calendarResult.events.length, calendarResult.durationMs);
    }

    if (calendarResult.events.length > 0) {
      const calendarItems = calendarResult.events.map((event) => ({
        title: event.summary,
        subtitle: [
          event.location,
          event.attendees.length > 0 ? `${event.attendees.length} attendees` : null,
          event.description?.slice(0, 150),
        ].filter(Boolean).join(' · ') || null,
        source: 'calendar',
        category: 'schedule' as const,
        score: 0,
        score_label: null,
        priority: event.isAllDay ? 3 : 5,
        tags: [
          event.isAllDay ? 'all-day' : 'meeting',
          event.meetLink || event.hangoutLink ? 'video-call' : null,
        ].filter(Boolean) as string[],
        contact_name: event.organizer,
        event_time: event.start,
        event_end_time: event.end,
        event_location: event.location,
        event_url: event.meetLink || event.hangoutLink || event.htmlLink,
        source_url: event.htmlLink,
        triage_date: today,
      }));

      const { data, error } = await supabaseServer
        .from('triage_items')
        .insert(calendarItems)
        .select('id');
      if (error) throw new Error(error.message);
      results.calendar.inserted = data?.length || 0;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Calendar: ${msg}`);
    await logHealth(runId, 'calendar', 'fetch_events', 'error', 0, Date.now() - calendarStart, msg);
  }

  // ══════════════════════════════════════════
  // STEP 2 + 3: APIFY JOB DISCOVERY + SCORING
  // ══════════════════════════════════════════
  const jobsStart = Date.now();
  try {
    if (!process.env.APIFY_API_TOKEN) {
      await logHealth(runId, 'apify', 'discover_jobs', 'skipped', 0, 0, 'APIFY_API_TOKEN not set');
    } else {
      const apifyResult = await discoverJobs();
      results.jobs.discovered = apifyResult.items.length;

      if (apifyResult.error) {
        await logHealth(runId, 'apify', 'discover_jobs',
          apifyResult.items.length > 0 ? 'ok' : 'error',
          apifyResult.items.length, apifyResult.durationMs, apifyResult.error);
      } else {
        await logHealth(runId, 'apify', 'discover_jobs', 'ok', apifyResult.items.length, apifyResult.durationMs);
      }

      if (apifyResult.items.length > 0) {
        // Score all discovered jobs
        const scoringResult = await scoreJobs(apifyResult.items);
        results.jobs.scored = scoringResult.scored.length;
        results.jobs.strong = scoringResult.scored.filter((s) => s.scoreLabel === 'strong').length;
        results.jobs.coverLetters = scoringResult.scored.filter((s) => s.coverLetter).length;

        await logHealth(runId, 'claude_scoring', 'score_jobs', scoringResult.error ? 'error' : 'ok',
          scoringResult.scored.length, scoringResult.durationMs, scoringResult.error || undefined);

        // Write scored jobs to triage_items
        const jobItems = scoringResult.scored
          .filter((s) => !s.disqualified && s.score >= 40)
          .map((s) => ({
            title: `${s.job.title} at ${s.job.company}`,
            subtitle: s.job.description.slice(0, 200),
            source: s.job.source === 'linkedin' ? 'linkedin' : 'other',
            category: 'job' as const,
            score: s.score,
            score_label: s.scoreLabel,
            score_breakdown: s.scoreBreakdown,
            priority: s.score >= 65 ? 8 : s.score >= 50 ? 6 : 4,
            tags: s.tags,
            company: s.job.company,
            role_title: s.job.title,
            location: s.job.location,
            salary_range: s.job.salary,
            job_type: s.job.jobType,
            easy_apply: s.job.easyApply,
            source_url: s.job.jobUrl,
            contact_url: s.job.applyUrl || s.job.jobUrl,
            cover_letter: s.coverLetter,
            triage_date: today,
            action_type: s.score >= 65 ? 'apply_job_website' as const : null,
            action_payload: s.score >= 65
              ? { job_url: s.job.jobUrl, company_career_url: s.job.applyUrl || '' }
              : {},
            action_status: s.score >= 65 ? 'pending_review' : null,
          }));

        if (jobItems.length > 0) {
          const { data, error } = await supabaseServer
            .from('triage_items')
            .insert(jobItems)
            .select('id');
          if (error) throw new Error(error.message);
          results.jobs.inserted = data?.length || 0;
        }

        // Also write to philippe_jobs for persistent tracking
        const philippeJobs = scoringResult.scored
          .filter((s) => !s.disqualified && s.score >= 40)
          .map((s) => ({
            title: s.job.title,
            company: s.job.company,
            location: s.job.location,
            work_mode: s.job.location?.toLowerCase().includes('remote') ? 'remote' : 'hybrid',
            apply_type: s.job.easyApply ? 'easy_apply' : 'website',
            job_url: s.job.jobUrl,
            description_text: s.job.description.slice(0, 2000),
            source: s.job.source,
            score: s.score,
            decision: s.score >= 65 ? 'STRONG_APPLY' : s.score >= 50 ? 'APPLY' : 'LIGHT',
            cover_note: s.coverLetter || '',
            apply_status: 'SCORED',
          }));

        if (philippeJobs.length > 0) {
          await supabaseServer.from('philippe_jobs').insert(philippeJobs);
        }

        // ── CV Tailoring for strong jobs ──
        const strongForCV = scoringResult.scored
          .filter((s) => s.scoreLabel === 'strong' && !s.disqualified)
          .slice(0, 5);

        if (strongForCV.length > 0) {
          try {
            const cvResult = await tailorCVForJobs(
              strongForCV.map((s) => ({
                id: s.job.jobUrl, // Use jobUrl as identifier
                title: s.job.title,
                company: s.job.company,
                description: s.job.description,
                score: s.score,
              }))
            );

            // Update triage_items with tailored CV notes
            for (const cv of cvResult.results) {
              await supabaseServer
                .from('triage_items')
                .update({
                  tailored_cv_notes: `**${cv.tailoring.suggestedTitle}**\n\nFocus: ${cv.tailoring.focusAreas.join(', ')}\nSkills: ${cv.tailoring.highlightedSkills.join(', ')}\n\n${cv.tailoring.notes}`,
                })
                .eq('triage_date', today)
                .eq('category', 'job')
                .ilike('source_url', `%${cv.jobId.split('/').pop()}%`);
            }

            results.jobs.cvTailored = cvResult.results.length;
            await logHealth(runId, 'claude_cv', 'tailor_cv', cvResult.error ? 'error' : 'ok',
              cvResult.results.length, cvResult.durationMs, cvResult.error || undefined);
          } catch (cvErr) {
            const cvMsg = cvErr instanceof Error ? cvErr.message : String(cvErr);
            results.errors.push(`CV Tailoring: ${cvMsg}`);
            await logHealth(runId, 'claude_cv', 'tailor_cv', 'error', 0, 0, cvMsg);
          }
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Jobs: ${msg}`);
    await logHealth(runId, 'apify', 'discover_jobs', 'error', 0, Date.now() - jobsStart, msg);
  }

  // ══════════════════════════════════════════
  // STEP 4A: PERPLEXITY NEWS (primary news source)
  // ══════════════════════════════════════════
  const perplexityStart = Date.now();
  try {
    if (!process.env.PERPLEXITY_API_KEY) {
      await logHealth(runId, 'perplexity', 'fetch_news', 'skipped', 0, 0, 'PERPLEXITY_API_KEY not set');
    } else {
      const perplexityResult = await fetchPerplexityNews();
      results.perplexityNews.fetched = perplexityResult.news.length;

      await logHealth(runId, 'perplexity', 'fetch_news',
        perplexityResult.error ? (perplexityResult.news.length > 0 ? 'ok' : 'error') : 'ok',
        perplexityResult.news.length, perplexityResult.durationMs, perplexityResult.error || undefined);

      if (perplexityResult.news.length > 0) {
        const newsItems = perplexityResult.news.slice(0, 25).map((item) => ({
          title: item.title,
          subtitle: item.summary,
          source: 'system',
          category: 'news' as const,
          score: 0,
          score_label: null,
          priority: item.category === 'event' ? 6 : item.category === 'competition' ? 7 : item.category === 'thought_leadership' ? 5 : 4,
          tags: [item.category, item.sourceName.toLowerCase().replace(/\s+/g, '-')],
          news_source: item.sourceName,
          news_image_url: item.imageUrl,
          source_url: item.url,
          triage_date: today,
        }));

        const { data, error } = await supabaseServer
          .from('triage_items')
          .insert(newsItems)
          .select('id');
        if (error) throw new Error(error.message);
        results.perplexityNews.inserted = data?.length || 0;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`Perplexity News: ${msg}`);
    await logHealth(runId, 'perplexity', 'fetch_news', 'error', 0, Date.now() - perplexityStart, msg);
  }

  // ══════════════════════════════════════════
  // STEP 4B: FIRECRAWL NEWS + EVENTS (fallback / content sources)
  // ══════════════════════════════════════════
  const newsStart = Date.now();
  try {
    if (!process.env.FIRECRAWL_API_KEY) {
      await logHealth(runId, 'firecrawl', 'scrape_news', 'skipped', 0, 0, 'FIRECRAWL_API_KEY not set');
    } else {
      const firecrawlResult = await scrapeIntelligence();
      results.firecrawlNews.scraped = firecrawlResult.news.length;

      await logHealth(runId, 'firecrawl', 'scrape_news',
        firecrawlResult.error ? (firecrawlResult.news.length > 0 ? 'ok' : 'error') : 'ok',
        firecrawlResult.news.length, firecrawlResult.durationMs, firecrawlResult.error || undefined);

      // Only insert Firecrawl news if Perplexity didn't already cover it
      if (firecrawlResult.news.length > 0 && results.perplexityNews.inserted === 0) {
        const newsItems = firecrawlResult.news.slice(0, 20).map((item) => ({
          title: item.title,
          subtitle: item.summary.slice(0, 300),
          source: 'system',
          category: 'news' as const,
          score: 0,
          score_label: null,
          priority: item.category === 'event' ? 6 : item.category === 'competition' ? 7 : 4,
          tags: [item.category, item.sourceName.toLowerCase().replace(/\s+/g, '-')],
          news_source: item.sourceName,
          source_url: item.url,
          event_location: item.location,
          triage_date: today,
        }));

        const { data, error } = await supabaseServer
          .from('triage_items')
          .insert(newsItems)
          .select('id');
        if (error) throw new Error(error.message);
        results.firecrawlNews.inserted = data?.length || 0;
      }

      // Write to philippe_intelligence for persistent tracking
      if (firecrawlResult.news.length > 0) {
        const intelligenceItems = firecrawlResult.news.slice(0, 20).map((item) => ({
          signal_type: item.category === 'event' ? 'event' :
            item.category === 'competition' ? 'hackathon' : 'market_trend',
          title: item.title,
          description: item.summary,
          source: item.sourceName,
          source_url: item.url,
          relevance_score: item.category === 'competition' ? 70 : 50,
          actionable: item.category === 'event' || item.category === 'competition',
        }));

        await supabaseServer.from('philippe_intelligence').insert(intelligenceItems);
      }

      // ══════════════════════════════════════════
      // STEP 5: CONTENT GENERATION
      // ══════════════════════════════════════════
      if (firecrawlResult.contentSources.length > 0) {
        const contentStart = Date.now();
        try {
          const contentResult = await generateContentDrafts(firecrawlResult.contentSources);
          results.content.drafts = contentResult.drafts.length;

          await logHealth(runId, 'claude_content', 'generate_content',
            contentResult.error ? 'error' : 'ok',
            contentResult.drafts.length, contentResult.durationMs, contentResult.error || undefined);

          if (contentResult.drafts.length > 0) {
            const draftRows = contentResult.drafts.map((draft) => ({
              title: draft.title,
              body: draft.body,
              hook: draft.hook,
              diagram_concept: draft.diagramConcept,
              source_type: draft.sourceType,
              source_urls: draft.sourceUrls,
              source_names: draft.sourceNames,
              topic_tags: draft.topicTags,
              content_format: draft.contentFormat,
              relevance_score: draft.relevanceScore,
              engagement_prediction: draft.engagementPrediction,
              status: 'draft',
            }));

            const { data, error } = await supabaseServer
              .from('content_drafts')
              .insert(draftRows)
              .select('id');
            if (error) throw new Error(error.message);
            results.content.inserted = data?.length || 0;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.errors.push(`Content: ${msg}`);
          await logHealth(runId, 'claude_content', 'generate_content', 'error', 0, Date.now() - contentStart, msg);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.errors.push(`News: ${msg}`);
    await logHealth(runId, 'firecrawl', 'scrape_news', 'error', 0, Date.now() - newsStart, msg);
  }

  // ══════════════════════════════════════════
  // STEP 6: CAREER PAGE EXTRACTION (for top jobs)
  // ══════════════════════════════════════════
  if (process.env.FIRECRAWL_API_KEY && results.jobs.strong > 0) {
    try {
      // Fetch strong jobs that need career page URLs
      const { data: strongJobs } = await supabaseServer
        .from('triage_items')
        .select('id, company, role_title, action_payload')
        .eq('triage_date', today)
        .eq('category', 'job')
        .eq('score_label', 'strong')
        .is('action_status', 'pending_review');

      if (strongJobs && strongJobs.length > 0) {
        for (const job of strongJobs.slice(0, 5)) { // Max 5 career page lookups
          const careerUrl = await scrapeCareerPage(
            job.company || '',
            job.role_title || ''
          );

          if (careerUrl) {
            const payload = (job.action_payload || {}) as Record<string, string>;
            await supabaseServer
              .from('triage_items')
              .update({
                action_payload: { ...payload, company_career_url: careerUrl },
                contact_url: careerUrl,
              })
              .eq('id', job.id);
          }
        }

        await logHealth(runId, 'firecrawl', 'career_pages', 'ok', strongJobs.length, 0);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Career pages: ${msg}`);
      await logHealth(runId, 'firecrawl', 'career_pages', 'error', 0, 0, msg);
    }
  }

  // ══════════════════════════════════════════
  // RESPONSE
  // ══════════════════════════════════════════
  const duration = Date.now() - startTime;

  return NextResponse.json({
    success: results.errors.length === 0,
    duration_ms: duration,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
