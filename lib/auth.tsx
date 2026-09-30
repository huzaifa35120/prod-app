import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { forgetPushToken, storedPushToken } from './usePushRegistration';
import { removePushToken } from './api';
import type { Profile } from './types';

interface AuthValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True until the persisted session has been read from storage. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves to true when a session was created, false when email confirmation is pending. */
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  const loadProfile = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (!error) setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        // The handle_new_user() trigger reads these to build the profile row.
        options: { data: { username: username.trim().toLowerCase(), display_name: displayName.trim() } },
      });
      if (error) throw error;
      // Null session means the project requires email confirmation first.
      return Boolean(data.session);
    },
    []
  );

  const signOut = useCallback(async () => {
    // Unregister this device first, so a signed-out phone stops being
    // notified about a challenge it can no longer see.
    try {
      const token = await storedPushToken();
      if (token && userId) await removePushToken(userId, token);
      await forgetPushToken();
    } catch {
      // Best effort — never block sign-out on it.
    }
    await supabase.auth.signOut();
    setProfile(null);
  }, [userId]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      initializing,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, initializing, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
