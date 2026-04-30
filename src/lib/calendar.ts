/**
 * Google Calendar API integration using OAuth2 refresh tokens.
 * Uses the same OAuth project as Gmail ("nano banan").
 * Fetches today's + tomorrow's events for the dashboard schedule tab.
 *
 * Requires scope: https://www.googleapis.com/auth/calendar.readonly
 * The existing GMAIL_REFRESH_TOKEN may need calendar scope added,
 * or a separate CALENDAR_REFRESH_TOKEN can be used.
 */

interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  htmlLink: string;
  hangoutLink: string | null;
  meetLink: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
  organizer: string | null;
  attendees: string[];
  isAllDay: boolean;
}

interface CalendarResult {
  events: CalendarEvent[];
  durationMs: number;
  error: string | null;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Exchange a refresh token for an access token (reuses Gmail OAuth project)
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  // Use dedicated calendar token if available, fall back to Gmail token
  const refreshToken = process.env.CALENDAR_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing OAuth credentials for Calendar (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, CALENDAR_REFRESH_TOKEN or GMAIL_REFRESH_TOKEN)');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get calendar access token: ${error}`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

/**
 * Fetch events from Google Calendar for a given time range.
 */
async function listEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  calendarId = 'primary',
  maxResults = 50
): Promise<CalendarEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calendar API error: ${response.status} ${error.slice(0, 300)}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map((event: Record<string, unknown>) => {
    const start = event.start as Record<string, string> | undefined;
    const end = event.end as Record<string, string> | undefined;
    const organizer = event.organizer as Record<string, string> | undefined;
    const attendees = (event.attendees as Array<Record<string, string>>) || [];
    const conferenceData = event.conferenceData as Record<string, unknown> | undefined;

    // Extract Meet link from conferenceData
    let meetLink: string | null = null;
    if (conferenceData?.entryPoints) {
      const entries = conferenceData.entryPoints as Array<Record<string, string>>;
      const videoEntry = entries.find((e) => e.entryPointType === 'video');
      meetLink = videoEntry?.uri || null;
    }

    return {
      id: String(event.id || ''),
      summary: String(event.summary || 'No title'),
      description: event.description ? String(event.description).slice(0, 500) : null,
      location: event.location ? String(event.location) : null,
      start: start?.dateTime || start?.date || '',
      end: end?.dateTime || end?.date || '',
      htmlLink: String(event.htmlLink || ''),
      hangoutLink: event.hangoutLink ? String(event.hangoutLink) : null,
      meetLink,
      status: (event.status as CalendarEvent['status']) || 'confirmed',
      organizer: organizer?.email || organizer?.displayName || null,
      attendees: attendees.map((a) => a.email || a.displayName || '').filter(Boolean),
      isAllDay: Boolean(start?.date && !start?.dateTime),
    };
  });
}

/**
 * Main export: Fetch today's and tomorrow's calendar events.
 * Returns structured events ready for the dashboard schedule tab.
 */
export async function fetchCalendarEvents(): Promise<CalendarResult> {
  const startTime = Date.now();

  try {
    const accessToken = await getAccessToken();

    // Time range: start of today → end of tomorrow (UTC-adjusted for CET/WEST)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(todayStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 2); // End of tomorrow

    const events = await listEvents(
      accessToken,
      todayStart.toISOString(),
      tomorrowEnd.toISOString()
    );

    // Filter out cancelled events
    const activeEvents = events.filter((e) => e.status !== 'cancelled');

    return {
      events: activeEvents,
      durationMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    return {
      events: [],
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type { CalendarEvent, CalendarResult };
