import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/env";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Desconecta: borra los tokens cifrados (la fila queda deshabilitada y sincronizada). */
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isMockMode) return NextResponse.json({ ok: true });
  const sb = getSupabaseServer();
  await sb
    ?.from("connectors_tokens")
    .update({ enabled: false, status: "disconnected", access_token_ciphertext: null, refresh_token_ciphertext: null, expires_at: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("provider", params.provider);
  return NextResponse.json({ ok: true });
}
