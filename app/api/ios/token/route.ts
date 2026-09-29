import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { isMockMode } from "@/lib/env";
import { stableId } from "@/lib/ids";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Genera (o rota) el token personal para los Atajos de iOS. Solo se guarda su hash. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = `jv_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  if (!isMockMode) {
    const sb = getSupabaseServer();
    const { error } = (await sb?.from("connectors_tokens").upsert(
      {
        id: stableId(user.id, "connector", "ios_shortcuts"),
        user_id: user.id,
        provider: "ios_shortcuts",
        kind: "app",
        enabled: true,
        status: "connected",
        metadata: { token_hash: hash, created_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )) ?? { error: { message: "no_db" } };
    if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ token, mock: isMockMode });
}
