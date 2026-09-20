/**
 * Supabase client. Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app
 * runs fully local (no account, no online) exactly as before.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Tolerate paste mistakes in the env values: whitespace, trailing slash, or the REST/Auth
// endpoint instead of the project URL (https://<ref>.supabase.co).
const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\/+$/, '') : undefined) || undefined;
const projectUrl = (v: string | undefined) => v?.replace(/\/(rest|auth|storage|functions|realtime)\/v1$/i, '');
const url = projectUrl(clean(import.meta.env.VITE_SUPABASE_URL));
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const cloudEnabled = supabase !== null;

if (import.meta.env.DEV) (window as unknown as { __sb?: unknown }).__sb = supabase;
