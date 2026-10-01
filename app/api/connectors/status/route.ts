import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/env";
import { configuredProviders } from "@/connectors/apps/oauth";

export const dynamic = "force-dynamic";

/** Qué inicios de sesión están listos en el servidor (sin revelar claves). */
export async function GET() {
  return NextResponse.json({ mock: isMockMode, configured: configuredProviders() });
}
