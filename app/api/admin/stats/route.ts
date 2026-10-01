import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/requireOwner";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Métricas agregadas para la futura app de propietario (usuarios, planes, ingresos, uso).
 * Doble candado: requireOwner aquí + la función SQL admin_stats() solo responde a propietarios.
 */
export async function GET(req: Request) {
  const guard = await requireOwner(req);
  if ("response" in guard) return guard.response;
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ mock: true, users_total: 0, by_plan: {}, generated_at: new Date().toISOString() });
  const { data, error } = await sb.rpc("admin_stats");
  if (error) return NextResponse.json({ error: "stats_failed" }, { status: 500 });
  return NextResponse.json(data);
}
