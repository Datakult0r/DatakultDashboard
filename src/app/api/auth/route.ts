import { NextRequest, NextResponse } from 'next/server';

/** POST /api/auth — exchange the dashboard password for the auth cookie. */
export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return NextResponse.json({ error: 'DASHBOARD_PASSWORD not configured' }, { status: 500 });
  }
  if (typeof password !== 'string' || password !== expected) {
    // Constant-ish response time; no detail leakage
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const data = new TextEncoder().encode(`ct:${expected}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const value = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

  const res = NextResponse.json({ success: true });
  res.cookies.set('ct_auth', value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return res;
}
