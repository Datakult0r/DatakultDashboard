import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client with service role key.
 * Used by API routes and cron jobs — NOT exposed to the browser.
 * Falls back to anon key if service role key is not set (with warning).
 * Lazy-initialized to avoid throwing during Next.js build/SSG.
 */

let _client: SupabaseClient | null = null;

function getSupabaseServer(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseServiceKey) {
    console.warn(
      '⚠️  SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. ' +
      'API routes may fail if RLS blocks updates.'
    );
  }

  const key = supabaseServiceKey || supabaseAnonKey;
  if (!key) {
    throw new Error('Missing both SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  _client = createClient(supabaseUrl, key, {
    auth: { persistSession: false },
  });

  return _client;
}

/** Lazy-initialized server Supabase client */
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseServer();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
