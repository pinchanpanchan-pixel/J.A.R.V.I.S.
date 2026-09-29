import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { open as unseal, seal } from "@/lib/crypto";
import { secret } from "@/lib/serverEnv";
import { exchangeToken, OAUTH } from "./oauth";

/** Token de acceso válido (refresca si caducó). null = no conectado. */
export async function getAccessToken(sb: SupabaseClient, userId: string, provider: string): Promise<string | null> {
  // Notion: el token de integración interna del propietario (.env NOTION_API_KEY) sirve de respaldo.
  const { data } = await sb
    .from("connectors_tokens")
    .select("id, access_token_ciphertext, refresh_token_ciphertext, expires_at, enabled")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data?.access_token_ciphertext) return provider === "notion" ? secret("NOTION_API_KEY") : null;
  const access = unseal(data.access_token_ciphertext, "oauth", userId);
  const expiresAt = data.expires_at ? Date.parse(data.expires_at) : Infinity;
  if (expiresAt - Date.now() > 60_000 || !data.refresh_token_ciphertext || !OAUTH[provider]) return access;

  const refresh = unseal(data.refresh_token_ciphertext, "oauth", userId);
  const t = await exchangeToken(provider, { grant_type: "refresh_token", refresh_token: refresh });
  await sb
    .from("connectors_tokens")
    .update({
      access_token_ciphertext: seal(t.access_token, "oauth", userId),
      refresh_token_ciphertext: t.refresh_token ? seal(t.refresh_token, "oauth", userId) : data.refresh_token_ciphertext,
      expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
      status: "connected",
    })
    .eq("id", data.id);
  return t.access_token;
}
