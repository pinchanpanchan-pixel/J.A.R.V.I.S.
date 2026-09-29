import type { HomeAdapter } from "./types";

/**
 * Philips Hue Remote API (OAuth de Hue). metadata.username = usuario del bridge
 * obtenido tras el enlace. Sin token: simulado.
 */
const BASE = "https://api.meethue.com/route/api";

function hexToXy(hex: string): [number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (c: number) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => lin(c / 255));
  const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
  const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
  const Z = r * 0.000088 + g * 0.07231 + b * 0.986039;
  const s = X + Y + Z || 1;
  return [Number((X / s).toFixed(4)), Number((Y / s).toFixed(4))];
}

export const hueAdapter: HomeAdapter = {
  meta: { id: "hue", name: "Philips Hue" },
  isReal: (ctx) => !!ctx.token && !!ctx.metadata.username,
  async listDevices(ctx) {
    if (!this.isReal(ctx)) return [];
    const res = await fetch(`${BASE}/${ctx.metadata.username}/lights`, { headers: { authorization: `Bearer ${ctx.token}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`hue ${res.status}`);
    const j = (await res.json()) as Record<string, { name: string; state: { on: boolean; bri: number; reachable: boolean } }>;
    return Object.entries(j).map(([id, l]) => ({
      external_id: id,
      name: l.name,
      room: null,
      type: "light" as const,
      state: { on: l.state.on, brightness: Math.round((l.state.bri / 254) * 100) },
      online: l.state.reachable,
    }));
  },
  async setState(ctx, device, patch) {
    if (!this.isReal(ctx)) return { ok: true };
    const body: Record<string, unknown> = {};
    if (patch.on !== undefined) body.on = patch.on;
    if (typeof patch.brightness === "number") body.bri = Math.round((patch.brightness / 100) * 254);
    if (typeof patch.color === "string") body.xy = hexToXy(patch.color);
    const res = await fetch(`${BASE}/${ctx.metadata.username}/lights/${device.external_id}/state`, {
      method: "PUT",
      headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `hue ${res.status}` };
  },
};
