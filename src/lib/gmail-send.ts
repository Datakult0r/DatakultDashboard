/**
 * Gmail send — the real /gmail/v1/users/me/messages/send call.
 *
 * Called from /api/actions/approve when AUTO_SEND_GMAIL_APPROVED=true and the
 * approved triage_item is a reply_email with a draft_reply.
 *
 * Account selection: 'business' uses GMAIL_REFRESH_TOKEN, 'personal' uses
 * GMAIL_REFRESH_TOKEN_PERSONAL. Same OAuth client_id / client_secret for both.
 *
 * Threading: when threadId / inReplyToMessageId are provided, the new message
 * is sent into the same thread with In-Reply-To + References headers so Gmail
 * keeps it threaded.
 */

interface SendInput {
  account: 'business' | 'personal';
  to: string | null;
  subject: string;
  body: string;
  inReplyToMessageId: string | null; // the ORIGINAL message's RFC822 Message-ID OR Gmail message id
  threadId: string | null;            // Gmail thread id
}

interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

const PHILIPPE_SIGNATURE = `

—
Philippe Küng
Founder & CEO, Clinic of AI
https://cal.read.ai/philippe-datakult/30-min`;

async function getAccessToken(account: 'business' | 'personal'): Promise<string> {
  const refreshToken = account === 'personal'
    ? process.env.GMAIL_REFRESH_TOKEN_PERSONAL
    : process.env.GMAIL_REFRESH_TOKEN;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(`Missing Gmail credentials for ${account} account`);
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300);
    throw new Error(`OAuth token refresh failed: ${detail}`);
  }
  const data = await r.json();
  return data.access_token;
}

function encodeRFC2047(s: string): string {
  // Only encode if the string has non-ASCII characters; otherwise pass-through.
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function buildRawMime(input: SendInput): string {
  const lines: string[] = [];
  if (input.to) lines.push(`To: ${input.to}`);
  lines.push(`Subject: ${encodeRFC2047(input.subject)}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: 8bit');
  if (input.inReplyToMessageId) {
    // Wrap with angle brackets if not already
    const id = input.inReplyToMessageId.startsWith('<') ? input.inReplyToMessageId : `<${input.inReplyToMessageId}>`;
    lines.push(`In-Reply-To: ${id}`);
    lines.push(`References: ${id}`);
  }
  lines.push('');
  const body = input.body.endsWith('Philippe') || input.body.includes('Philippe Küng') ? input.body : input.body + PHILIPPE_SIGNATURE;
  lines.push(body);

  // Gmail expects URL-safe base64
  const raw = Buffer.from(lines.join('\r\n'), 'utf8').toString('base64');
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendGmailReply(input: SendInput): Promise<SendResult> {
  if (!input.to) return { ok: false, error: 'No recipient address' };
  if (!input.body) return { ok: false, error: 'No body' };

  try {
    const accessToken = await getAccessToken(input.account);
    const raw = buildRawMime(input);
    const body: Record<string, unknown> = { raw };
    if (input.threadId) body.threadId = input.threadId;

    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return { ok: false, error: `Gmail send ${r.status}: ${detail}` };
    }
    const data = await r.json();
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
