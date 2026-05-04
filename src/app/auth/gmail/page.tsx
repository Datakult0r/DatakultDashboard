'use client';

import { useEffect, useState } from 'react';
import { Mail, ExternalLink, AlertCircle } from 'lucide-react';

interface StartResponse {
  consentUrl?: string;
  redirectUri?: string;
  error?: string;
}

/**
 * /auth/gmail — guided helper to refresh the Gmail/Calendar OAuth refresh token.
 *
 * Flow:
 * 1. User lands here, sees the Google consent button
 * 2. Click goes to Google → user authenticates → Google redirects to /api/auth/gmail/callback
 * 3. Callback exchanges code for refresh_token and renders it for copy/paste into Vercel
 */
export default function GmailAuthPage() {
  const [data, setData] = useState<StartResponse | null>(null);

  useEffect(() => {
    fetch('/api/auth/gmail/start')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: 'Failed to load OAuth config' }));
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-xl w-full bg-surface border border-border rounded-lg p-6 space-y-5">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-tertiary font-mono">
            Control Tower · re-auth
          </p>
          <h1 className="text-2xl font-semibold text-primary mt-1 flex items-center gap-2">
            <Mail size={20} className="text-accent" />
            Gmail + Calendar OAuth
          </h1>
        </div>

        <div className="text-sm text-secondary space-y-2">
          <p>
            Your <code className="px-1 py-0.5 bg-elevated rounded text-accent text-xs font-mono">GMAIL_REFRESH_TOKEN</code>
            {' '}is rejected by Google (<code className="text-xs font-mono text-danger">invalid_grant</code>).
            That breaks the morning cron&apos;s Gmail + Calendar fetch.
          </p>
          <p>
            This page generates a fresh token via Google&apos;s consent flow.
            Three minutes, no terminal needed.
          </p>
        </div>

        {data?.error && (
          <div className="bg-danger/10 border border-danger/30 rounded p-3 flex gap-2 text-sm text-danger">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{data.error}</span>
          </div>
        )}

        {data?.consentUrl ? (
          <>
            <div className="bg-elevated/40 border border-border rounded p-3 text-xs font-mono text-tertiary">
              <div>redirect_uri:</div>
              <div className="text-secondary break-all mt-0.5">{data.redirectUri}</div>
              <div className="mt-2 text-[11px] text-tertiary">
                ⚠ Make sure this URI is added to your Google Cloud OAuth client&apos;s
                Authorized redirect URIs (it might say <code>http://localhost:9876</code> in the existing config).
              </div>
            </div>

            <a
              href={data.consentUrl}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-accent text-base font-semibold text-sm rounded-md hover:bg-accent-bright transition-colors"
            >
              Authorize Google access
              <ExternalLink size={14} />
            </a>

            <details className="text-xs text-tertiary">
              <summary className="cursor-pointer hover:text-secondary">What happens next?</summary>
              <ol className="mt-2 list-decimal list-inside space-y-1">
                <li>Google asks you to choose your account (use philippe.kung@clinicofai.com).</li>
                <li>You see a consent screen — click Allow.</li>
                <li>Google redirects you back to this app.</li>
                <li>The callback page shows the fresh refresh_token + paste instructions for Vercel.</li>
                <li>Update env, then HEALTH tab → Run cron now to verify.</li>
              </ol>
            </details>
          </>
        ) : !data?.error ? (
          <div className="text-sm text-tertiary">Loading…</div>
        ) : null}
      </div>
    </main>
  );
}
