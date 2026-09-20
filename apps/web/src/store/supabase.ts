/**
 * Supabase client. Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app
 * runs fully local (no account, no online) exactly as before.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const cloudEnabled = supabase !== null;

if (import.meta.env.DEV) (window as unknown as { __sb?: unknown }).__sb = supabase;
