import type { HomeAdapter } from "./types";

/** Govee Developer API (clave de la app Govee Home → Ajustes → Apply for API Key). */
const BASE = "https://developer-api.govee.com/v1";

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export const goveeAdapter: HomeAdapter = {
  meta: { id: "govee", name: "Govee" },
  isReal: (ctx) => !!ctx.token,
  async listDevices(ctx) {
    if (!ctx.token) return [];
    const res = await fetch(`${BASE}/devices`, { headers: { "Govee-API-Key": ctx.token }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`govee ${res.status}`);
    const j = (await res.json()) as { data?: { devices?: Array<{ device: string; model: string; deviceName: string; controllable: boolean }> } };
    return (j.data?.devices ?? []).map((d) => ({
      external_id: d.device,
      name: d.deviceName,
      room: null,
      type: "light" as const,
      state: { on: false, brightness: 100 },
      online: d.controllable,
      meta: { model: d.model },
    }));
  },
  async setState(ctx, device, patch) {
    if (!ctx.token) return { ok: true };
    const model = String(device.meta?.model ?? "");
    const cmds: Array<{ name: string; value: unknown }> = [];
    if (patch.on !== undefined) cmds.push({ name: "turn", value: patch.on ? "on" : "off" });
    if (typeof patch.brightness === "number") cmds.push({ name: "brightness", value: patch.brightness });
    if (typeof patch.color === "string") cmds.push({ name: "color", value: hexToRgb(patch.color) });
    for (const cmd of cmds) {
      const res = await fetch(`${BASE}/devices/control`, {
        method: "PUT",
        headers: { "Govee-API-Key": ctx.token, "content-type": "application/json" },
        body: JSON.stringify({ device: device.external_id, model, cmd }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { ok: false, error: `govee ${res.status}` };
    }
    return { ok: true };
  },
};
