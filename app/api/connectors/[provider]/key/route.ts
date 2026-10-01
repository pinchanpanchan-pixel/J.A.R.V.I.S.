import { NextResponse } from "next/server";
import { z } from "zod";
import { isMockMode } from "@/lib/env";
import { stableId } from "@/lib/ids";
import { seal } from "@/lib/crypto";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";
import { connectorById } from "@/connectors/registry";
import { homeAdapter } from "@/connectors/home";
import { deviceRows } from "@/connectors/home/sync";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const Body = z.object({ fields: z.record(z.string(), z.string().max(300)) });

/**
 * Conecta un fabricante con clave (Govee, Tuya): comprueba la clave pidiendo la lista de
 * dispositivos, la guarda CIFRADA y guarda los dispositivos encontrados.
 */
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`key:${user.id}`, 10)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const meta = connectorById(params.provider);
  const adapter = homeAdapter(params.provider);
  if (!meta || meta.auth !== "api_key" || !adapter) return NextResponse.json({ error: "unsupported" }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const f = parsed.data.fields;
  for (const k of meta.keyFields ?? []) if (!f[k.id]?.trim()) return NextResponse.json({ error: "missing_field", field: k.id }, { status: 400 });

  // Govee: la clave tal cual. Tuya: JSON con los cuatro datos.
  const token = params.provider === "govee" ? f.api_key.trim() : JSON.stringify(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()])));
  if (isMockMode) return NextResponse.json({ ok: true, devices: 0, mock: true });

  let devices;
  try {
    devices = await adapter.listDevices({ token, metadata: {} });
  } catch {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { error } = await sb.from("connectors_tokens").upsert(
    {
      id: stableId(user.id, "connector", params.provider),
      user_id: user.id,
      provider: params.provider,
      kind: "home",
      enabled: true,
      status: "connected",
      access_token_ciphertext: seal(token, "oauth", user.id),
      refresh_token_ciphertext: null,
      expires_at: null,
      scopes: [],
      metadata: { account: `${devices.length} ${devices.length === 1 ? "dispositivo" : "dispositivos"}` },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  const rows = deviceRows(user.id, params.provider, devices);
  if (rows.length) await sb.from("smart_home_devices").upsert(rows, { onConflict: "id" });
  return NextResponse.json({ ok: true, devices: rows.length });
}
