import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { open as unseal } from "@/lib/crypto";
import { stableId } from "@/lib/ids";
import { homeAdapter } from "./index";
import type { HomeAdapterContext, RemoteDevice } from "./types";

/** Credenciales descifradas de un fabricante (solo servidor). */
export async function homeContext(sb: SupabaseClient, userId: string, provider: string): Promise<HomeAdapterContext> {
  const { data } = await sb.from("connectors_tokens").select("access_token_ciphertext, metadata").eq("user_id", userId).eq("provider", provider).maybeSingle();
  return {
    token: data?.access_token_ciphertext ? unseal(data.access_token_ciphertext, "oauth", userId) : null,
    metadata: (data?.metadata as Record<string, unknown>) ?? {},
  };
}

/** Filas de smart_home_devices (mismo id que usa el cliente: no se duplican). */
export function deviceRows(userId: string, provider: string, devices: RemoteDevice[]) {
  return devices.map((d) => ({
    id: stableId(userId, provider, d.external_id),
    user_id: userId,
    provider,
    external_id: d.external_id,
    name: d.name,
    room: d.room,
    type: d.type,
    state: { ...d.state, ...(d.meta ? { meta: d.meta } : {}) },
    online: d.online,
    updated_at: new Date().toISOString(),
  }));
}

/** Trae los dispositivos reales del fabricante y los guarda (se sincronizan a todos los dispositivos). */
export async function syncHomeDevices(sb: SupabaseClient, userId: string, provider: string, ctx?: HomeAdapterContext): Promise<number> {
  const adapter = homeAdapter(provider);
  if (!adapter) return 0;
  const c = ctx ?? (await homeContext(sb, userId, provider));
  if (!adapter.isReal(c)) return 0;
  const rows = deviceRows(userId, provider, await adapter.listDevices(c));
  if (rows.length) {
    const { error } = await sb.from("smart_home_devices").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  return rows.length;
}
