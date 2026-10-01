import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getServerFeatures } from "@/lib/auth/serverPlan";
import { isMockMode } from "@/lib/env";
import { geminiModels } from "@/lib/ai/gemini";
import { serverKeys } from "@/services/aiRouter";

export const dynamic = "force-dynamic";

/** Qué cerebros tiene el servidor (sin revelar claves). Solo propietarios. */
export async function GET(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isMockMode && !(await getServerFeatures(user.id)).isOwner) return NextResponse.json({ error: "owners_only" }, { status: 403 });
  const keys = serverKeys();
  return NextResponse.json({
    chain: keys.map((k) => k.provider),
    geminiModel: geminiModels()[0],
  });
}
