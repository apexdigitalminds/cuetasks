import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Cloud sync is optional. CueTasks runs fully local-first when these are unset;
// auth/sync features only light up once the env vars are provided.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
