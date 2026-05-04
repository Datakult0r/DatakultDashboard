import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/auth/gmail/callback?code=...
 *
 * Exchanges the authorization code for a refresh_token and renders an HTML page
 * showing the new token to paste into the Vercel env. The token is NEVER logged
 * server-side and NEVER stored in the database — it just transits through this
 * response and lives only in the browser tab.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  if (error) return htmlError(`Google returned error: ${error}`);
  if (!code) return htmlError('No code in callback URL.');

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return htmlError('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET not set in env.');

  const redirectUri = `${request.nextUrl.origin}/api/auth/gmail/callback`;

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = await r.json();
    if (!r.ok) return htmlError(`Token exchange failed: ${JSON.stringify(data).slice(0, 400)}`);
    const refreshToken = data.refresh_token;
    if (!refreshToken) return htmlError('No refresh_token returned. Make sure the OAuth client is in production mode and the consent screen forced offline+prompt=consent.');

    return htmlSuccess(refreshToken);
  } catch (err) {
    return htmlError(err instanceof Error ? err.message : String(err));
  }
}

function htmlError(message: string): NextResponse {
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>Gmail OAuth — error</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0d0e;color:#ecf0f2;padding:48px;max-width:720px;margin:auto}h1{color:#f4796a;font-size:18px}pre{background:#14181a;border:1px solid #262d31;padding:16px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font-size:13px}</style>
</head><body><h1>OAuth error</h1><pre>${escapeHtml(message)}</pre><p><a style="color:#7dd3a0" href="/api/auth/gmail/start">Try again</a></p></body></html>`;
  return new NextResponse(body, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function htmlSuccess(refreshToken: string): NextResponse {
  // Note: token rendered to HTML — only ever sent to the browser tab that initiated
  // the flow (one-shot ephemeral redirect). Never stored.
  const safe = escapeHtml(refreshToken);
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>Gmail OAuth — success</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b0d0e;color:#ecf0f2;padding:48px;max-width:720px;margin:auto;line-height:1.5}
h1{color:#7dd3a0;font-size:18px;margin:0 0 4px}
.sub{color:#8c9499;font-size:13px;margin-bottom:24px}
pre{background:#14181a;border:1px solid #262d31;padding:16px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font-family:JetBrains Mono,monospace;font-size:13px}
button{background:#7dd3a0;color:#0b0d0e;border:0;border-radius:6px;padding:8px 16px;font-weight:600;cursor:pointer;margin-top:8px}
button:hover{background:#a3e0bd}
.step{background:#14181a;border:1px solid #262d31;border-radius:8px;padding:16px;margin:12px 0}
.step h3{margin:0 0 8px;color:#ecf0f2;font-size:14px}
code{background:#1c2125;padding:2px 6px;border-radius:3px;font-family:JetBrains Mono,monospace;font-size:12px;color:#7dd3a0}
a{color:#7dd3a0}
</style></head><body>
<h1>✓ Refresh token received</h1>
<div class="sub">This token grants offline Gmail + Calendar access. Treat it as a secret. It's only on this page — never stored server-side.</div>

<div class="step">
  <h3>1. Copy the token</h3>
  <pre id="tok">${safe}</pre>
  <button onclick="navigator.clipboard.writeText(document.getElementById('tok').innerText).then(()=>this.innerText='Copied ✓')">Copy</button>
</div>

<div class="step">
  <h3>2. Update Vercel env vars</h3>
  <p>Open <a href="https://vercel.com/co-ai-118c92ff/datakult-dashboard/settings/environment-variables" target="_blank">Vercel → Project → Settings → Environment Variables</a></p>
  <ul>
    <li>Find <code>GMAIL_REFRESH_TOKEN</code> (Production scope)</li>
    <li>Edit → paste the token above → Save</li>
    <li>(Optional) Same value works for Calendar — add <code>GOOGLE_CALENDAR_REFRESH_TOKEN</code> if separate var exists</li>
  </ul>
  <p class="sub">Env var changes take effect on the next serverless invocation (no redeploy needed).</p>
</div>

<div class="step">
  <h3>3. Verify</h3>
  <p>Open the dashboard → HEALTH tab → click <code>Run cron now</code>. Gmail should flip from <span style="color:#f4796a">error</span> to <span style="color:#4ade80">ok</span>.</p>
  <p><a href="/">← Back to Control Tower</a></p>
</div>

<script>
// Auto-clear the token from DOM after 5 minutes for safety
setTimeout(() => {
  const t = document.getElementById('tok');
  if (t) t.innerText = '(token cleared — refresh page to see again, or run the OAuth flow again)';
}, 5 * 60 * 1000);
</script>
</body></html>`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Hard no-cache — never want this rendered from cache
      'cache-control': 'no-store, max-age=0',
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
