import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/env";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";
import { syncHomeDevices } from "@/connectors/home/sync";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Vuelve a leer los dispositivos de todos los fabricantes conectados (botón «Actualizar»). */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isMockMode) return NextResponse.json({ ok: true, devices: 0, mock: true });
  if (!rateLimit(`homesync:${user.id}`, 6)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { data } = await sb.from("connectors_tokens").select("provider").eq("user_id", user.id).eq("kind", "home").eq("status", "connected");
  let devices = 0;
  const failed: string[] = [];
  for (const { provider } of data ?? []) {
    try {
      devices += await syncHomeDevices(sb, user.id, provider);
    } catch {
      failed.push(provider);
    }
  }
  return NextResponse.json({ ok: failed.length === 0, devices, failed });
}
