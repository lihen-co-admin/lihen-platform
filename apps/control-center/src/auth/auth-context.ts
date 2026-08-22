import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AdminAuthorizationProfile } from './authorization';

export interface SignUpResult {
  readonly needsEmailConfirmation: boolean;
}

export interface AuthContextValue {
  readonly enabled: boolean;
  readonly bootstrapSignUpEnabled: boolean;
  readonly session: Session | null;
  readonly user: User | null;
  readonly profile: AdminAuthorizationProfile | null;
  readonly knownRoleCodes: readonly string[];
  readonly authorized: boolean;
  readonly authorizationReason: 'ACTIVE_ROLE' | 'NO_PROFILE' | 'INACTIVE_PROFILE' | 'UNKNOWN_ROLE';
  readonly loading: boolean;
  readonly authorizationLoading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signInWithGitHub(redirectTo?: string): Promise<void>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
