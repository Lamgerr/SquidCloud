// Centralized Supabase env. The anon key is public-by-design, but hardcoding a
// production fallback couples an open-source checkout to one specific project
// and blocks rotation. All config now comes from Vite env at build time.
export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
export const SUPABASE_ANON_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

export const hasSupabaseEnv =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
