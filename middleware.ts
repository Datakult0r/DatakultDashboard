import { NextRequest, NextResponse } from 'next/server';

/**
 * Dashboard authentication gate.
 *
 * WHY: the dashboard and its action APIs were fully public — anyone with the
 * URL could read triage data (email snippets, contacts, drafts) and trigger
 * approve/apply actions. The Supabase anon key is also committed to a public
 * repo, so RLS alone cannot be assumed.
 *
 * HOW: set DASHBOARD_PASSWORD in Vercel env. Everything (pages + APIs) then
 * requires the auth cookie except:
 *   - /login + /api/auth (the gate itself)
 *   - cron routes, which authenticate with their own CRON_SECRET Bearer header
 * If DASHBOARD_PASSWORD is unset, the middleware is a no-op (no lockout on
 * first deploy — but set it!).
 */
const CRON_PATHS = ['/api/triage/collect', '/api/actions/execute'];
const PUBLIC_PATHS = ['/login', '/api/auth'];

async function expectedCookieValue(password: string): Promise<string> {
  const data = new TextEncoder().encode(`ct:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Cron routes carry their own Bearer secret
  if (CRON_PATHS.some((p) => pathname.startsWith(p))) {
    const auth = request.headers.get('authorization');
    if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.next();
    }
    // fall through to cookie check (manual POSTs from the authed dashboard)
  }

  const cookie = request.cookies.get('ct_auth')?.value;
  if (cookie && cookie === await expectedCookieValue(password)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
