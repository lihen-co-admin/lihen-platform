import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import { AuthContext, type AuthContextValue } from './auth-context';
import {
  decideAdminAuthorization,
  type AdminAuthorizationProfile,
} from './authorization';

interface ProfileRow {
  readonly id: string;
  readonly email: string | null;
  readonly display_name: string | null;
  readonly role_code: string;
  readonly authorization_status: string;
}

interface RoleRow {
  readonly code: string;
}

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
  const [profile, setProfile] = useState<AdminAuthorizationProfile | null>(null);
  const [knownRoleCodes, setKnownRoleCodes] = useState<readonly string[]>([]);
  const [authorizationLoading, setAuthorizationLoading] = useState(enabled);

  const loadAuthorization = useCallback(async (nextSession: Session | null) => {
    if (!client || !nextSession?.user) {
      setProfile(null);
      setKnownRoleCodes([]);
      setAuthorizationLoading(false);
      return;
    }

    setAuthorizationLoading(true);
    try {
      const [{ data: profileData, error: profileError }, { data: roleData, error: roleError }] =
        await Promise.all([
          client
            .from('profiles')
            .select('id,email,display_name,role_code,authorization_status')
            .eq('id', nextSession.user.id)
            .maybeSingle<ProfileRow>(),
          client.from('admin_roles').select('code').returns<RoleRow[]>(),
        ]);

      if (profileError) throw profileError;
      if (roleError) throw roleError;

      setProfile(
        profileData
          ? {
              id: profileData.id,
              email: profileData.email,
              displayName: profileData.display_name,
              roleCode: profileData.role_code,
              authorizationStatus: profileData.authorization_status,
            }
          : null,
      );
      setKnownRoleCodes((roleData ?? []).map((role: RoleRow) => role.code));
    } catch (error) {
      console.error('Unable to resolve Control Center authorization.', error);
      setProfile(null);
      setKnownRoleCodes([]);
    } finally {
      setAuthorizationLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!client) {
      setSession(null);
      setLoading(false);
      setAuthorizationLoading(false);
      return;
    }

    let mounted = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error('Unable to restore Supabase session.', error);
      const nextSession = data.session ?? null;
      setSession(nextSession);
      setLoading(false);
      void loadAuthorization(nextSession);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
      void loadAuthorization(nextSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [client, loadAuthorization]);

  const authorizationDecision = useMemo(
    () => decideAdminAuthorization(profile, knownRoleCodes),
    [knownRoleCodes, profile],
  );

  const value = useMemo<AuthContextValue>(() => ({
    enabled,
    bootstrapSignUpEnabled,
    session,
    user: session?.user ?? null,
    profile,
    knownRoleCodes,
    authorized: authorizationDecision.authorized,
    authorizationReason: authorizationDecision.reason,
    loading,
    authorizationLoading,
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
      setProfile(null);
      setKnownRoleCodes([]);
    },
  }), [
    authorizationDecision.authorized,
    authorizationDecision.reason,
    authorizationLoading,
    bootstrapSignUpEnabled,
    client,
    enabled,
    knownRoleCodes,
    loadAuthorization,
    loading,
    profile,
    session,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
