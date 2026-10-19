import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient, parseBrowserEnv } from '@lihen/database';
import { AuthContext, type AuthContextValue } from './auth-context';
import { decideAdminAuthorization, type AdminAuthorizationProfile } from './authorization';

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
  const mountedRef = useRef(false);
  const authorizationRevision = useRef(0);
  const authorizationUser = useRef<string | null>(null);
  const authorizationAbort = useRef<AbortController | null>(null);

  const loadAuthorization = useCallback(
    async (nextSession: Session | null) => {
      if (!client || !nextSession?.user) {
        authorizationRevision.current++;
        authorizationAbort.current?.abort();
        authorizationUser.current = null;
        setProfile(null);
        setKnownRoleCodes([]);
        setAuthorizationLoading(false);
        return;
      }

      if (authorizationUser.current === nextSession.user.id) return;
      authorizationAbort.current?.abort();
      const revision = ++authorizationRevision.current;
      const controller = new AbortController();
      authorizationAbort.current = controller;
      authorizationUser.current = nextSession.user.id;
      const current = () => mountedRef.current && revision === authorizationRevision.current;
      setAuthorizationLoading(true);
      const timeout = setTimeout(() => {
        if (!current()) return;
        authorizationRevision.current++;
        controller.abort();
        authorizationUser.current = null;
        setProfile(null);
        setKnownRoleCodes([]);
        setAuthorizationLoading(false);
      }, 15000);
      try {
        const [{ data: profileData, error: profileError }, { data: roleData, error: roleError }] =
          await Promise.all([
            client
              .from('profiles')
              .select('id,email,display_name,role_code,authorization_status')
              .eq('id', nextSession.user.id)
              .abortSignal(controller.signal)
              .maybeSingle<ProfileRow>(),
            client
              .from('admin_roles')
              .select('code')
              .abortSignal(controller.signal)
              .returns<RoleRow[]>(),
          ]);

        if (!current()) return;

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
        if (!current()) return;
        console.error(
          'Unable to resolve Control Center authorization.',
          error instanceof Error ? error.name : 'AUTHORIZATION_READ_FAILED',
        );
        setProfile(null);
        setKnownRoleCodes([]);
      } finally {
        clearTimeout(timeout);
        if (current()) {
          authorizationUser.current = null;
          setAuthorizationLoading(false);
        }
      }
    },
    [client],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (!client) {
      setSession(null);
      setLoading(false);
      setAuthorizationLoading(false);
      return;
    }

    let mounted = true;
    let observedEvent = false;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const scheduleAuthorization = (next: Session | null) => {
      clearTimeout(pending);
      if (!next?.user) {
        void loadAuthorization(null);
        return;
      }
      setAuthorizationLoading(true);
      // Never start Supabase requests while its auth notification lock is held.
      pending = setTimeout(() => {
        if (mounted) void loadAuthorization(next);
      }, 0);
    };
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted || observedEvent) return;
        if (error) console.error('Unable to restore Supabase session.', error);
        const nextSession = data.session ?? null;
        setSession(nextSession);
        setLoading(false);
        scheduleAuthorization(nextSession);
      })
      .catch(() => {
        if (!mounted || observedEvent) return;
        setSession(null);
        setLoading(false);
        scheduleAuthorization(null);
      });

    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      observedEvent = true;
      const next = event === 'SIGNED_OUT' ? null : nextSession;
      setSession(next);
      setLoading(false);
      scheduleAuthorization(next);
    });

    return () => {
      mounted = false;
      mountedRef.current = false;
      clearTimeout(pending);
      authorizationRevision.current++;
      authorizationAbort.current?.abort();
      authorizationUser.current = null;
      subscription.subscription.unsubscribe();
    };
  }, [client, loadAuthorization]);

  const authorizationDecision = useMemo(
    () => decideAdminAuthorization(profile, knownRoleCodes),
    [knownRoleCodes, profile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
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
        const defaultRedirect = new URL(import.meta.env.BASE_URL, window.location.href);
        defaultRedirect.hash = '/dev-auth-probe';
        const safeRedirect = redirectTo ?? defaultRedirect.href;
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
    }),
    [
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
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
