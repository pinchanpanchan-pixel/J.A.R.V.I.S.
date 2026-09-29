import { NextResponse } from "next/server";
import { z } from "zod";
import { isMockMode } from "@/lib/env";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";
import { open as unseal } from "@/lib/crypto";
import { homeAdapter } from "@/connectors/home";

export const dynamic = "force-dynamic";

const Body = z.object({
  provider: z.string().max(40),
  external_id: z.string().max(200),
  meta: z.record(z.string(), z.unknown()).optional(),
  patch: z.record(z.string(), z.unknown()),
});

/** Ejecuta una orden sobre un dispositivo real con las credenciales (cifradas) del usuario. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const adapter = homeAdapter(parsed.data.provider);
  if (!adapter) return NextResponse.json({ error: "unknown_provider" }, { status: 400 });

  let token: string | null = null;
  let metadata: Record<string, unknown> = {};
  if (!isMockMode) {
    const sb = getSupabaseServer();
    const { data } = (await sb?.from("connectors_tokens").select("access_token_ciphertext, metadata").eq("user_id", user.id).eq("provider", parsed.data.provider).maybeSingle()) ?? {
      data: null,
    };
    if (data?.access_token_ciphertext) token = unseal(data.access_token_ciphertext, "oauth", user.id);
    metadata = (data?.metadata as Record<string, unknown>) ?? {};
  }
  const ctx = { token, metadata };
  try {
    const r = await adapter.setState(ctx, { external_id: parsed.data.external_id, meta: parsed.data.meta }, parsed.data.patch);
    return NextResponse.json({ ...r, real: adapter.isReal(ctx) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 502 });
  }
}
