/**
 * Gmail API integration using OAuth2 refresh tokens.
 * Fetches unread emails from the last 24 hours and returns structured data.
 * No browser needed — runs server-side via Google APIs.
 */

interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  isUnread: boolean;
  labels: string[];
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Exchange a refresh token for an access token
 */
async function getAccessToken(creds: GmailCredentials): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = (await response.json()) as TokenResponse;
  return data.access_token;
}

/**
 * Fetch Gmail messages matching a query
 */
async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 20
): Promise<Array<{ id: string; threadId: string }>> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list messages: ${error}`);
  }

  const data = await response.json();
  return data.messages || [];
}

/**
 * Fetch a single message by ID with full content
 */
async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get message ${messageId}: ${error}`);
  }

  const data = await response.json();
  const headers = data.payload?.headers || [];

  const getHeader = (name: string): string =>
    headers.find((h: { name: string; value: string }) =>
      h.name.toLowerCase() === name.toLowerCase()
    )?.value || '';

  // Extract plain text body
  let body = '';
  if (data.payload?.body?.data) {
    body = Buffer.from(data.payload.body.data, 'base64url').toString('utf-8');
  } else if (data.payload?.parts) {
    const textPart = data.payload.parts.find(
      (p: { mimeType: string }) => p.mimeType === 'text/plain'
    );
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
    }
  }

  return {
    id: data.id,
    threadId: data.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    snippet: data.snippet || '',
    body: body.slice(0, 2000), // Limit body to 2000 chars for scoring
    date: getHeader('Date'),
    isUnread: (data.labelIds || []).includes('UNREAD'),
    labels: data.labelIds || [],
  };
}

/**
 * Main export: Fetch all unread emails from the last 24 hours.
 * Returns structured messages ready for scoring.
 */
export async function fetchUnreadEmails(): Promise<GmailMessage[]> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Gmail OAuth credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)');
  }

  const accessToken = await getAccessToken({ clientId, clientSecret, refreshToken });

  // Search: unread, last 24h, skip promotions/social/forums
  const query = 'is:unread newer_than:1d -category:promotions -category:social -category:updates -category:forums';
  const messageRefs = await listMessages(accessToken, query, 30);

  if (messageRefs.length === 0) {
    return [];
  }

  // Fetch full messages in parallel (batch of 10 max to avoid rate limits)
  const messages: GmailMessage[] = [];
  const batchSize = 10;

  for (let i = 0; i < messageRefs.length; i += batchSize) {
    const batch = messageRefs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((ref) => getMessage(accessToken, ref.id))
    );
    messages.push(...batchResults);
  }

  return messages;
}

export type { GmailMessage };
