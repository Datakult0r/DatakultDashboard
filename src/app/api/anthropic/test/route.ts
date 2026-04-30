import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/anthropic/test
 *
 * Cheapest-possible Claude call (1 output token, haiku) to verify the production
 * ANTHROPIC_API_KEY is valid AND has credit. Reports back a precise classification:
 *   ok            — credits available, key works
 *   no_credits    — key valid but balance is zero
 *   invalid_key   — key is rejected
 *   network_error — outbound call failed
 */
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      status: 'invalid_key',
      message: 'ANTHROPIC_API_KEY is not set in production env',
    });
  }

  // Mask the key for display — never leak the actual value
  const masked = `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`;
  const keyLength = apiKey.length;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ok' }],
      }),
    });

    if (r.ok) {
      const body = await r.json();
      return NextResponse.json({
        status: 'ok',
        message: 'API key works and has credits',
        keyMasked: masked,
        keyLength,
        modelTested: 'claude-haiku-4-5-20251001',
        usage: body.usage,
      });
    }

    const text = await r.text();
    let status: 'no_credits' | 'invalid_key' | 'rate_limited' | 'unknown' = 'unknown';
    if (text.includes('credit balance')) status = 'no_credits';
    else if (r.status === 401 || text.includes('authentication_error')) status = 'invalid_key';
    else if (r.status === 429) status = 'rate_limited';

    return NextResponse.json({
      status,
      httpStatus: r.status,
      message: text.slice(0, 500),
      keyMasked: masked,
      keyLength,
    });
  } catch (err) {
    return NextResponse.json({
      status: 'network_error',
      message: err instanceof Error ? err.message : String(err),
      keyMasked: masked,
      keyLength,
    });
  }
}
