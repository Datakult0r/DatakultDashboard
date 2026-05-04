import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/browser-use';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/browser-use/test
 *
 * Diagnostic — verifies BROWSER_USE_API_KEY against api.browser-use.com.
 * Reports a precise classification and masked key info, never leaks the key.
 */
export async function GET() {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      status: 'invalid_key',
      message: 'BROWSER_USE_API_KEY not set in production env',
    });
  }

  const masked = `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
  const result = await verifyAuth(apiKey);
  if (result.ok) {
    return NextResponse.json({
      status: 'ok',
      message: 'Browser Use API key works',
      keyMasked: masked,
      keyLength: apiKey.length,
    });
  }
  let status: 'invalid_key' | 'no_credits' | 'unknown' = 'unknown';
  if (result.status === 401 || result.status === 403) status = 'invalid_key';
  else if (result.status === 402 || result.status === 429) status = 'no_credits';

  return NextResponse.json({
    status,
    httpStatus: result.status,
    message: result.detail ?? '',
    keyMasked: masked,
    keyLength: apiKey.length,
  });
}
