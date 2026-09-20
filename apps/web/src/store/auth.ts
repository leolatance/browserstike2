import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const redirectTo = () => `${window.location.origin}/login`;

export async function signInWithEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Nuvem desligada');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Nuvem desligada');
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Current session (null when logged out or cloud disabled). */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session, loading };
}
