import "server-only";
import { z } from "zod";
import { isMockMode } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { StoredKey } from "@/services/aiRouter";

export const StoredKeySchema = z.object({
  id: z.string().max(64),
  provider: z.enum(["openai", "anthropic", "gemini", "groq", "openrouter"]),
  key_ciphertext: z.string().max(2000),
  enabled: z.boolean(),
});

/**
 * Claves de IA del usuario. En producción se leen de la BD (RLS); en modo simulado
 * viajan cifradas desde el cliente (la BD simulada vive en el navegador) y solo el
 * servidor puede descifrarlas.
 */
export async function loadUserKeys(userId: string, fromBody: unknown): Promise<StoredKey[]> {
  if (isMockMode) {
    const parsed = z.array(StoredKeySchema).max(50).safeParse(fromBody ?? []);
    return parsed.success ? parsed.data : [];
  }
  const sb = getSupabaseServer();
  const { data } = (await sb?.from("ai_provider_keys").select("id, provider, key_ciphertext, enabled").eq("user_id", userId).is("deleted_at", null)) ?? {
    data: null,
  };
  return (data ?? []) as StoredKey[];
}
