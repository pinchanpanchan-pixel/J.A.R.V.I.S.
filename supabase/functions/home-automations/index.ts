// Automatizaciones del hogar (pg_cron cada minuto): «apaga todo a las 11pm» aunque la app esté cerrada.
import { admin, authorized, json } from "../_shared/admin.ts";
import { openSealed } from "../_shared/crypto.ts";
import { cronMatches, minuteKey } from "../_shared/core/cron.ts";
import { applyPatch, parseHomeCommand, selectDevices } from "../_shared/core/homeController.ts";
import type { SmartHomeDeviceRow } from "../_shared/core/types.ts";

async function goveeControl(apiKey: string, device: SmartHomeDeviceRow, state: Record<string, unknown>) {
  const cmds: Array<{ name: string; value: unknown }> = [];
  if (state.on !== undefined) cmds.push({ name: "turn", value: state.on ? "on" : "off" });
  if (typeof state.brightness === "number") cmds.push({ name: "brightness", value: state.brightness });
  for (const cmd of cmds) {
    await fetch("https://developer-api.govee.com/v1/devices/control", {
      method: "PUT",
      headers: { "Govee-API-Key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ device: device.external_id, model: (device.state as { meta?: { model?: string } }).meta?.model ?? "", cmd }),
    }).catch(() => null);
  }
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  const sb = admin();
  const { data: autos, error } = await sb.from("home_automations").select("*").eq("enabled", true).is("deleted_at", null);
  if (error) return json({ error: error.message }, 500);
  const now = new Date();
  let ran = 0;
  for (const a of autos ?? []) {
    if (!cronMatches(a.cron, now, a.timezone)) continue;
    const key = minuteKey(now, a.timezone);
    if (a.last_run_at && minuteKey(new Date(a.last_run_at), a.timezone) === key) continue; // ya la ejecutó un dispositivo
    await sb.from("home_automations").update({ last_run_at: now.toISOString() }).eq("id", a.id);
    const { data: devices } = await sb.from("smart_home_devices").select("*").eq("user_id", a.user_id).is("deleted_at", null);
    const list = (devices ?? []) as SmartHomeDeviceRow[];
    const rooms = Array.from(new Set(list.map((d) => d.room).filter(Boolean))) as string[];
    const intent = parseHomeCommand(a.command, rooms, list.map((d) => d.name));
    if (intent.kind === "unknown") continue;
    const { data: govee } = await sb.from("connectors_tokens").select("access_token_ciphertext").eq("user_id", a.user_id).eq("provider", "govee").maybeSingle();
    const goveeKey = govee?.access_token_ciphertext ? await openSealed(govee.access_token_ciphertext, "oauth", a.user_id).catch(() => null) : null;
    for (const d of selectDevices(list, intent.target)) {
      const next = applyPatch(d, intent.patch);
      await sb.from("smart_home_devices").update({ state: next, updated_at: now.toISOString() }).eq("id", d.id);
      if (d.provider === "govee" && goveeKey) await goveeControl(goveeKey, d, next);
    }
    ran++;
  }
  return json({ ok: true, ran });
});
