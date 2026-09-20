/**
 * Supabase client. Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app
 * runs fully local (no account, no online) exactly as before.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Tolerate a trailing slash / stray whitespace in the env values (a common paste mistake).
const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\/+$/, '') : undefined) || undefined;
const url = clean(import.meta.env.VITE_SUPABASE_URL);
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const cloudEnabled = supabase !== null;

if (import.meta.env.DEV) (window as unknown as { __sb?: unknown }).__sb = supabase;
