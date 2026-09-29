import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, isMockMode } from "@/lib/env";
import { serverEnv } from "@/lib/serverEnv";

/** Cliente con la sesión del usuario (respeta RLS). null en modo simulado. */
export function getSupabaseServer(): SupabaseClient | null {
  if (isMockMode) return null;
  const store = cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        try {
          store.set({ name, value, ...options });
        } catch {
          /* llamado desde un Server Component: se ignora */
        }
      },
      remove: (name: string, options: CookieOptions) => {
        try {
          store.set({ name, value: "", ...options });
        } catch {
          /* idem */
        }
      },
    },
  });
}

/** Cliente con service_role (salta RLS). Solo para backend. null en modo simulado. */
export function getSupabaseAdmin(): SupabaseClient | null {
  const key = serverEnv.serviceRoleKey;
  if (isMockMode || !key) return null;
  return createClient(publicEnv.supabaseUrl, key, { auth: { persistSession: false } });
}
