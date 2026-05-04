import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/auth/gmail/start
 *
 * Returns the Google OAuth consent URL configured for our Gmail+Calendar scopes
 * with offline access and forced consent (so we always get a refresh_token).
 *
 * The redirect_uri must be configured in the Google Cloud OAuth client.
 * For self-serve flow we use {origin}/api/auth/gmail/callback.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'GMAIL_CLIENT_ID not set' }, { status: 500 });

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/gmail/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  const consentUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.json({ consentUrl, redirectUri });
}
