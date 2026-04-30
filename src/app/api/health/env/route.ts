import { NextResponse } from 'next/server';

/**
 * GET /api/health/env
 *
 * Lightweight diagnostic — reports which integration environment variables are
 * present in the runtime, WITHOUT leaking values. The dashboard surfaces this
 * so Philippe can see at a glance which integrations are wired vs missing.
 *
 * Returns 200 always; payload signals red/green per key.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'CRON_SECRET',
] as const;

const OPTIONAL_KEYS = [
  'GMAIL_REFRESH_TOKEN_PERSONAL',
  'PERPLEXITY_API_KEY',
  'APIFY_API_TOKEN',
  'FIRECRAWL_API_KEY',
  'BROWSER_USE_API_KEY',
] as const;

export async function GET() {
  const required: Record<string, boolean> = {};
  const optional: Record<string, boolean> = {};

  for (const k of REQUIRED_KEYS) {
    required[k] = Boolean(process.env[k]);
  }
  for (const k of OPTIONAL_KEYS) {
    optional[k] = Boolean(process.env[k]);
  }

  const requiredMissing = REQUIRED_KEYS.filter((k) => !required[k]);
  const optionalMissing = OPTIONAL_KEYS.filter((k) => !optional[k]);

  return NextResponse.json({
    ok: requiredMissing.length === 0,
    required,
    optional,
    requiredMissing,
    optionalMissing,
    runtime: {
      nodeVersion: process.version,
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelRegion: process.env.VERCEL_REGION || null,
    },
    timestamp: new Date().toISOString(),
  });
}
