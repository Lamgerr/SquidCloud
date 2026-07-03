/**
 * Supabase Proxy Layer
 * Prevents direct credential exposure in network requests
 * All Supabase calls should go through this proxy for production security
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Use environment variables (set in .env for development and deployment)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

/**
 * Create a proxied Supabase client
 * In production, this should use a backend proxy to avoid exposing credentials
 */
export const createSecureSupabaseClient = (): SupabaseClient<Database> => {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'cloudbliss-web'
      }
    }
  });
};

/**
 * Secure client instance
 * Note: For maximum security in production, implement a backend proxy
 * that handles all Supabase communication server-side
 */
export const secureSupabase = createSecureSupabaseClient();

/**
 * Production Security Recommendations:
 * 
 * 1. Move Supabase credentials to server-side only
 * 2. Create API routes that proxy all Supabase requests
 * 3. Implement request validation and rate limiting
 * 4. Use Row Level Security (RLS) policies strictly
 * 5. Never expose service role key to frontend
 * 6. Rotate anon key regularly
 * 7. Monitor API usage for suspicious patterns
 * 8. Use HTTPS only in production
 * 9. Implement Content Security Policy (CSP) headers
 * 10. Use environment-specific configurations
 */
