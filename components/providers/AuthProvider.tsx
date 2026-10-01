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
  /**
   * Manda un código de 6 dígitos al email (el correo trae también un enlace, por si acaso).
   * En modo simulado no hay correo: devuelve el código para enseñarlo en pantalla.
   */
  sendEmailCode: (email: string) => Promise<{ mockCode?: string }>;
  /** Comprueba el código y abre la sesión. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
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
    // Renovar el token NO es un usuario nuevo: se conserva el mismo objeto para no reiniciar la app.
    const keep = (next: AuthUser | null) =>
      setUser((prev) => (prev && next && prev.id === next.id && prev.email === next.email ? prev : next));
    const toUser = (u: { id: string; email?: string | null; app_metadata?: { provider?: string } } | null | undefined) =>
      u
        ? {
            id: u.id,
            email: u.email ?? "",
            provider: (u.app_metadata?.provider ?? "email") as AuthUser["provider"],
          }
        : null;
    sb.auth.getSession().then(({ data }) => {
      keep(toUser(data.session?.user));
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      keep(toUser(session?.user));
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const redirectTo = `${typeof window !== "undefined" ? window.location.origin : publicEnv.appUrl}/auth/callback`;

  const google = useCallback(async () => {
    if (isMockMode) {
      const email = window.prompt("Modo simulado: ¿con qué email entras con Google?", "pinchan.panchan@gmail.com");
      if (email) mockSignIn(email, "google");
      return;
    }
    const { error } = await getSupabaseBrowser()!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
  }, [redirectTo]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      mock: isMockMode,
      signInWithGoogle: google,
      sendEmailCode: async (email: string) => {
        const clean = email.trim().toLowerCase();
        if (isMockMode) {
          const code = String(Math.floor(100000 + Math.random() * 900000));
          sessionStorage.setItem(`jarvis.mockCode.${clean}`, code);
          return { mockCode: code };
        }
        const { error } = await getSupabaseBrowser()!.auth.signInWithOtp({
          email: clean,
          options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        return {};
      },
      verifyEmailCode: async (email: string, code: string) => {
        const clean = email.trim().toLowerCase();
        if (isMockMode) {
          if (sessionStorage.getItem(`jarvis.mockCode.${clean}`) !== code) throw new Error("invalid_code");
          sessionStorage.removeItem(`jarvis.mockCode.${clean}`);
          mockSignIn(clean, "email");
          return;
        }
        const { error } = await getSupabaseBrowser()!.auth.verifyOtp({ email: clean, token: code, type: "email" });
        if (error) throw error;
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
    [user, loading, google, redirectTo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
