import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface SignUpResult {
  readonly needsEmailConfirmation: boolean;
}

export interface AuthContextValue {
  readonly enabled: boolean;
  readonly bootstrapSignUpEnabled: boolean;
  readonly session: Session | null;
  readonly user: User | null;
  readonly loading: boolean;
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
