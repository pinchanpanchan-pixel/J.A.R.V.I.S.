import { createHash, createHmac, randomUUID } from "node:crypto";
import type { DeviceType } from "@/types/db";
import type { HomeAdapter, HomeAdapterContext, RemoteDevice } from "./types";

/**
 * Tuya / Smart Life (Cloud API). Credenciales del proyecto de iot.tuya.com + UID de la
 * cuenta de Smart Life vinculada. ctx.token = JSON {access_id, access_secret, uid, region}.
 */
const HOSTS: Record<string, string> = {
  eu: "https://openapi.tuyaeu.com",
  us: "https://openapi.tuyaus.com",
  cn: "https://openapi.tuyacn.com",
  in: "https://openapi.tuyain.com",
};

export interface TuyaCreds {
  access_id: string;
  access_secret: string;
  uid: string;
  region: string;
}

export function parseTuya(token: string | null): TuyaCreds | null {
  if (!token) return null;
  try {
    const c = JSON.parse(token) as TuyaCreds;
    return c.access_id && c.access_secret && c.uid ? { ...c, region: HOSTS[c.region] ? c.region : "eu" } : null;
  } catch {
    return null;
  }
}

/** Firma HMAC-SHA256 de Tuya (versión 2021+). */
export function tuyaSign(c: Pick<TuyaCreds, "access_id" | "access_secret">, accessToken: string, t: string, nonce: string, method: string, path: string, body = ""): string {
  const contentHash = createHash("sha256").update(body).digest("hex");
  const stringToSign = [method.toUpperCase(), contentHash, "", path].join("\n");
  return createHmac("sha256", c.access_secret).update(c.access_id + accessToken + t + nonce + stringToSign).digest("hex").toUpperCase();
}

async function call<T>(c: TuyaCreds, method: string, path: string, accessToken = "", body?: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  const t = String(Date.now());
  const nonce = randomUUID();
  const raw = body === undefined ? "" : JSON.stringify(body);
  const res = await fetchImpl(`${HOSTS[c.region]}${path}`, {
    method,
    headers: {
      client_id: c.access_id,
      sign: tuyaSign(c, accessToken, t, nonce, method, path, raw),
      sign_method: "HMAC-SHA256",
      t,
      nonce,
      ...(accessToken ? { access_token: accessToken } : {}),
      "content-type": "application/json",
    },
    body: raw || undefined,
    signal: AbortSignal.timeout(10000),
  });
  const j = (await res.json().catch(() => ({}))) as { success?: boolean; result?: T; msg?: string };
  if (!res.ok || !j.success) throw new Error(`tuya ${j.msg ?? res.status}`);
  return j.result as T;
}

async function token(c: TuyaCreds): Promise<string> {
  return (await call<{ access_token: string }>(c, "GET", "/v1.0/token?grant_type=1")).access_token;
}

const TYPE: Record<string, DeviceType> = { dj: "light", dd: "light", fwd: "light", cz: "plug", pc: "plug", kg: "switch", kt: "ac", tv: "tv" };
const SWITCH_CODES = ["switch_led", "switch_1", "switch"];

export const tuyaAdapter: HomeAdapter = {
  meta: { id: "tuya", name: "Tuya / Smart Life" },
  isReal: (ctx: HomeAdapterContext) => !!parseTuya(ctx.token),
  async listDevices(ctx) {
    const c = parseTuya(ctx.token);
    if (!c) return [];
    const at = await token(c);
    const list = await call<Array<{ id: string; name: string; category: string; online: boolean; status?: Array<{ code: string; value: unknown }> }>>(c, "GET", `/v1.0/users/${encodeURIComponent(c.uid)}/devices`, at);
    return list.map((d): RemoteDevice => {
      const sw = d.status?.find((s) => SWITCH_CODES.includes(s.code));
      return {
        external_id: d.id,
        name: d.name,
        room: null,
        type: TYPE[d.category] ?? "switch",
        state: { on: sw ? Boolean(sw.value) : false },
        online: d.online,
        meta: { switchCode: sw?.code ?? "switch_1", category: d.category },
      };
    });
  },
  async setState(ctx, device, patch) {
    const c = parseTuya(ctx.token);
    if (!c) return { ok: true };
    const commands: Array<{ code: string; value: unknown }> = [];
    if (patch.on !== undefined) commands.push({ code: String(device.meta?.switchCode ?? "switch_1"), value: patch.on });
    if (typeof patch.brightness === "number" && device.meta?.category === "dj") commands.push({ code: "bright_value_v2", value: Math.max(10, Math.round(patch.brightness * 10)) });
    if (!commands.length) return { ok: true };
    const at = await token(c);
    await call(c, "POST", `/v1.0/devices/${encodeURIComponent(device.external_id)}/commands`, at, { commands });
    return { ok: true };
  },
};
