"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isMockMode, publicEnv } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { getMockSession, mockSignIn, mockSignOut, onMockAuthChange } from "@/lib/auth/mockAuth";
import type { AuthUser } from "@/lib/auth/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  mock: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** Envía magic link (real) o entra directamente (simulado). */
  signInWithEmail: (email: string) => Promise<{ sent: boolean }>;
  signOut: () => Promise<void>;
  /** Token de acceso actual (para APIs y Background Sync). */
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMockMode) {
      const sync = () => {
        setUser(getMockSession());
        setLoading(false);
      };
      sync();
      return onMockAuthChange(sync);
    }
    const sb = getSupabaseBrowser()!;
    const toUser = (u: { id: string; email?: string | null; app_metadata?: { provider?: string } } | null | undefined) =>
      u
        ? {
            id: u.id,
            email: u.email ?? "",
            provider: (u.app_metadata?.provider ?? "email") as AuthUser["provider"],
          }
        : null;
    sb.auth.getSession().then(({ data }) => {
      setUser(toUser(data.session?.user));
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session?.user));
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const redirectTo = `${typeof window !== "undefined" ? window.location.origin : publicEnv.appUrl}/auth/callback`;

  const oauth = useCallback(
    async (provider: "google" | "apple") => {
      if (isMockMode) {
        const email = window.prompt(
          `Modo simulado: ¿con qué email entras con ${provider === "google" ? "Google" : "Apple"}?`,
          "pinchan.panchan@gmail.com",
        );
        if (email) mockSignIn(email, provider);
        return;
      }
      await getSupabaseBrowser()!.auth.signInWithOAuth({ provider, options: { redirectTo } });
    },
    [redirectTo],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      mock: isMockMode,
      signInWithGoogle: () => oauth("google"),
      signInWithApple: () => oauth("apple"),
      signInWithEmail: async (email: string) => {
        if (isMockMode) {
          mockSignIn(email, "email");
          return { sent: false };
        }
        const { error } = await getSupabaseBrowser()!.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        return { sent: true };
      },
      signOut: async () => {
        if (isMockMode) mockSignOut();
        else await getSupabaseBrowser()!.auth.signOut();
      },
      getAccessToken: async () => {
        if (isMockMode) return null;
        const { data } = await getSupabaseBrowser()!.auth.getSession();
        return data.session?.access_token ?? null;
      },
    }),
    [user, loading, oauth, redirectTo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
