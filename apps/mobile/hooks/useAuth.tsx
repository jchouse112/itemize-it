import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, AUTH_CALLBACK_URL } from '../lib/supabase';
import * as Linking from 'expo-linking';

function isValidJWT(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    for (const part of parts) {
      if (!/^[A-Za-z0-9_-]+$/.test(part)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload.exp || typeof payload.exp !== 'number') return true;
    return payload.exp < (Date.now() / 1000) - 30;
  } catch {
    return true;
  }
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setPassword: (password: string) => Promise<{ error?: string }>;
  needsPasswordSetup: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle deep link for magic link callback
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (__DEV__) {
        console.log('=== DEEP LINK RECEIVED ===');
        console.log('URL path:', url.split('?')[0].split('#')[0]);
      }

      if (url.includes('auth/callback') || url.includes('access_token')) {
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        // Try hash fragment first (Supabase uses #access_token=...)
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const hash = url.substring(hashIndex + 1);
          const hashParams = new URLSearchParams(hash);
          accessToken = hashParams.get('access_token');
          refreshToken = hashParams.get('refresh_token');
        }

        // Fall back to query params
        if (!accessToken) {
          try {
            const urlObj = new URL(url);
            accessToken = urlObj.searchParams.get('access_token');
            refreshToken = urlObj.searchParams.get('refresh_token');
          } catch {
            const queryIndex = url.indexOf('?');
            if (queryIndex !== -1) {
              const query = url.substring(queryIndex + 1);
              const queryParams = new URLSearchParams(query);
              accessToken = queryParams.get('access_token');
              refreshToken = queryParams.get('refresh_token');
            }
          }
        }

        if (accessToken && refreshToken) {
          if (!isValidJWT(accessToken)) {
            if (__DEV__) console.warn('Invalid access token format');
            return;
          }
          if (isTokenExpired(accessToken)) {
            if (__DEV__) console.warn('Access token is expired');
            return;
          }

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error && __DEV__) {
            console.error('Failed to set session:', error);
          }
        }
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  const signInWithMagicLink = useCallback(async (email: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: AUTH_CALLBACK_URL,
        },
      });
      if (error) return { error: error.message };
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send magic link';
      return { error: message };
    }
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      return { error: message };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      return { error: message };
    }
  }, []);

  const setPasswordFn = useCallback(async (password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { has_password: true },
      });
      if (error) return { error: error.message };
      // Update local user state
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set password';
      return { error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  // User needs password setup if they signed in via magic link and haven't set a password
  const needsPasswordSetup = useMemo(() => {
    if (!user) return false;
    return user.user_metadata?.has_password !== true &&
      user.app_metadata?.provider === 'email' &&
      !user.user_metadata?.has_password;
  }, [user]);

  const value = useMemo(() => ({
    session,
    user,
    loading,
    signInWithMagicLink,
    signInWithPassword,
    signUp,
    signOut,
    setPassword: setPasswordFn,
    needsPasswordSetup,
  }), [session, user, loading, signInWithMagicLink, signInWithPassword, signUp, signOut, setPasswordFn, needsPasswordSetup]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
