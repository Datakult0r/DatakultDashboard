/**
 * Provenance helpers — turn raw `source` / `action_type` / `apply_type` codes into
 * human-readable "How did we get this?" + "What are we going to do?" labels.
 *
 * Used by every card in the dashboard so the user can see at a glance:
 *   1. WHO/WHAT collected the data (Apify, RemoteOK, Perplexity, Beeper, Gmail…)
 *   2. WHICH ACTION the dashboard is proposing (Easy Apply, Reply DM, Send proposal…)
 */

export type BrandKey = 'linkedin' | 'apify' | 'perplexity' | 'beeper' | 'gmail' | 'google_calendar' | 'browser_use' | 'firecrawl' | 'remoteok' | 'arbeit_swiss' | null;

export interface MethodLabel {
  /** Short label e.g. "Apify · LinkedIn" */
  short: string;
  /** Tooltip / explainer */
  hint: string;
  /** lucide-react icon name as a string — caller resolves */
  icon: 'globe' | 'mail' | 'message' | 'briefcase' | 'newspaper' | 'calendar' | 'cpu' | 'link';
  /** Tailwind text class for the chip */
  tone: 'info' | 'accent' | 'success' | 'money' | 'warning' | 'tertiary';
  /** Brand key for BrandIcons map (when method has a recognizable brand mark). */
  brandKey?: BrandKey;
}

/** Map an internal `source` value to the user-facing "how did we get this?" label */
export function methodFor(source: string | null | undefined, category?: string | null): MethodLabel {
  const s = (source ?? '').toLowerCase();
  switch (s) {
    case 'linkedin':
      return { short: 'Apify · LinkedIn job board', hint: 'Public LinkedIn job listing scraped via Apify (no LinkedIn login used).', icon: 'briefcase', tone: 'info', brandKey: 'linkedin' };
    case 'remoteok':
      return { short: 'RemoteOK · public feed', hint: 'Pulled from RemoteOK\'s free public JSON feed.', icon: 'globe', tone: 'warning', brandKey: 'remoteok' };
    case 'arbeit_swiss':
      return { short: 'Arbeit.Swiss · government portal', hint: 'Switzerland\'s official government job portal (Job-Room.ch / RAV) via Apify. Authoritative for the Swiss market — every Swiss employer above the headcount threshold posts here first.', icon: 'briefcase', tone: 'success', brandKey: 'arbeit_swiss' };
    case 'wttj':
      return { short: 'Welcome to the Jungle', hint: 'Welcome to the Jungle job board (Apify scraper).', icon: 'briefcase', tone: 'success', brandKey: 'apify' };
    case 'indeed':
      return { short: 'Indeed', hint: 'Indeed job board scraper.', icon: 'briefcase', tone: 'info', brandKey: 'apify' };
    case 'jobup':
      return { short: 'JobUp.ch', hint: 'Swiss job board.', icon: 'briefcase', tone: 'info' };
    case 'gmail':
    case 'email':
      return { short: 'Gmail (work)', hint: 'Read from philippe.kung@clinicofai.com inbox via Gmail API.', icon: 'mail', tone: 'info', brandKey: 'gmail' };
    case 'gmail_personal':
      return { short: 'Gmail (personal)', hint: 'Read from philippelobokung@gmail.com inbox via Gmail API.', icon: 'mail', tone: 'accent', brandKey: 'gmail' };
    case 'linkedin_dm':
    case 'beeper':
      return { short: 'Beeper · LinkedIn DMs', hint: 'LinkedIn direct message bridged through Beeper Desktop.', icon: 'message', tone: 'accent', brandKey: 'beeper' };
    case 'whatsapp':
      return { short: 'Beeper · WhatsApp', hint: 'WhatsApp message bridged through Beeper Desktop.', icon: 'message', tone: 'success', brandKey: 'beeper' };
    case 'calendar':
      return { short: 'Google Calendar', hint: 'Read from your Google Calendar via Calendar API.', icon: 'calendar', tone: 'tertiary', brandKey: 'google_calendar' };
    case 'system':
      // Perplexity items are stored with source='system' — disambiguate by category
      if (category === 'event') return { short: 'Perplexity · events search', hint: 'AI conferences/meetups in CH + EU discovered via Perplexity Sonar.', icon: 'calendar', tone: 'success', brandKey: 'perplexity' };
      if (category === 'news')  return { short: 'Perplexity · news search', hint: 'AI/tech news discovered via Perplexity Sonar with citations.', icon: 'newspaper', tone: 'info', brandKey: 'perplexity' };
      return { short: 'System', hint: 'Internal system entry.', icon: 'cpu', tone: 'tertiary' };
    case 'firecrawl':
      return { short: 'Firecrawl · web scrape', hint: 'Page content scraped via Firecrawl.', icon: 'link', tone: 'tertiary', brandKey: 'firecrawl' };
    case 'browser_use':
      return { short: 'Browser Use Cloud', hint: 'Action taken by an automated browser in Browser Use Cloud.', icon: 'cpu', tone: 'success', brandKey: 'browser_use' };
    default:
      return { short: source ?? 'Unknown', hint: 'Source not classified.', icon: 'link', tone: 'tertiary' };
  }
}

export interface ActionLabel {
  short: string;
  hint: string;
  tone: 'success' | 'accent' | 'info' | 'warning' | 'tertiary';
}

/** Map an internal `action_type` (and category context) to "what we'll do" */
export function actionFor(
  actionType: string | null | undefined,
  category?: string | null,
  applyType?: string | null,
): ActionLabel | null {
  const a = (actionType ?? '').toLowerCase();
  if (!a && !category) return null;

  switch (a) {
    case 'send_message':
      return { short: 'Reply LinkedIn DM', hint: 'Send a draft reply via Beeper. Drafts only — never sent without your approval.', tone: 'accent' };
    case 'send_email':
      return { short: 'Reply via Gmail draft', hint: 'Save a Gmail draft in your inbox; you click Send.', tone: 'info' };
    case 'apply_job_easy':
      return { short: 'Easy Apply (Browser Use)', hint: 'Submit through LinkedIn Easy Apply via Browser Use Cloud, using the generated cover letter.', tone: 'success' };
    case 'apply_job_website':
      return { short: 'Apply on company site', hint: 'Open the company\'s career page so you can apply manually with the tailored cover letter.', tone: 'success' };
    case 'schedule_meeting':
      return { short: 'Suggest a meeting time', hint: 'Draft a calendar invite for you to send.', tone: 'info' };
    case 'mark_followup':
      return { short: 'Mark followed up', hint: 'Resolve this SLA-tracked item — you handled it.', tone: 'tertiary' };
    case 'promote_to_engagement':
      return { short: 'Promote to lead', hint: 'Move this contact into the customer pipeline (Leads stage).', tone: 'accent' };
  }

  // Fall back on category when action_type is missing
  if (category === 'job') {
    if (applyType === 'easy_apply') return { short: 'Easy Apply (Browser Use)', hint: 'Submit through LinkedIn Easy Apply via Browser Use Cloud.', tone: 'success' };
    return { short: 'Apply on company site', hint: 'Open the posting and apply with the tailored cover letter.', tone: 'success' };
  }
  if (category === 'event') return { short: 'Save / register', hint: 'Open the event page in a new tab.', tone: 'success' };
  if (category === 'news')  return { short: 'Read more', hint: 'Open the article in a new tab.', tone: 'info' };
  if (category === 'urgent' || category === 'review') return { short: 'Reply or skip', hint: 'Decide whether this needs a reply, then approve or skip.', tone: 'accent' };
  if (category === 'schedule') return { short: 'Open in calendar', hint: 'Open the calendar event.', tone: 'info' };

  return null;
}

/** Decide whether `contact_url` is safe to hyperlink from the card */
export function safeContactUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Only allow https + safe domains
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Try to derive a LinkedIn handle for display from a profile URL */
export function linkedInHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('linkedin.com')) return null;
    const m = u.pathname.match(/\/in\/([^/]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
