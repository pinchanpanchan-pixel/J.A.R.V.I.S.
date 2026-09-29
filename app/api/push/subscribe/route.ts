import { NextResponse } from "next/server";
import { z } from "zod";
import { isMockMode } from "@/lib/env";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** Guarda la suscripción Web Push (recordatorio del diario y alertas de WorldMonitor). */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (isMockMode) return NextResponse.json({ ok: true, mock: true });
  const sb = getSupabaseServer();
  const { error } = (await sb?.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  )) ?? { error: { message: "no_db" } };
  return error ? NextResponse.json({ error: "save_failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}
