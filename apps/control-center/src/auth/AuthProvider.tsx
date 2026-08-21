import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const env = useMemo(() => parseBrowserEnv(import.meta.env), []);
  const enabled = env.VITE_AUTH_MODE === 'supabase';
  const bootstrapSignUpEnabled = enabled && env.VITE_DEV_ALLOW_BOOTSTRAP_SIGNUP;
  const client = useMemo(
    () => (enabled ? getBrowserSupabaseClient(import.meta.env) : null),
    [enabled],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!client) {
      setSession(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error('Unable to restore Supabase session.', error);
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(() => ({
    enabled,
    bootstrapSignUpEnabled,
    session,
    user: session?.user ?? null,
    loading,
    async signIn(email: string, password: string) {
      if (!client) throw new Error('Supabase Auth is disabled.');
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signInWithGitHub(redirectTo?: string) {
      if (!client) throw new Error('Supabase Auth is disabled.');
      const safeRedirect = redirectTo ?? `${window.location.origin}/dev-auth-probe`;
      const { error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: safeRedirect },
      });
      if (error) throw error;
    },
    async signUp(email: string, password: string) {
      if (!client) throw new Error('Supabase Auth is disabled.');
      if (!bootstrapSignUpEnabled) throw new Error('DEV bootstrap signup is disabled.');

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: 'LIHEN DEV Administrator',
            bootstrap_source: 'control-center',
          },
        },
      });
      if (error) throw error;

      return { needsEmailConfirmation: data.session === null };
    },
    async signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
  }), [bootstrapSignUpEnabled, client, enabled, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
