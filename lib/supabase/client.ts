"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, isMockMode } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Cliente de Supabase para el navegador (sesión persistente en cookies). null en modo simulado. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (isMockMode) return null;
  if (!client) {
    client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
