import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseServer } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Canjea / valida un código (función SQL atómica redeem_discount_code).
 * 100 %: activa el plan sin pasar por Stripe. <100 %: devuelve el descuento para el pago.
 */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  if (!rateLimit(`code:${user.id}`, 10)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const parsed = z.object({ code: z.string().min(1).max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
  const sb = getSupabaseServer();
  if (!sb) return NextResponse.json({ ok: false, error: "mock_mode" }, { status: 400 });
  const { data, error } = await sb.rpc("redeem_discount_code", { p_code: parsed.data.code });
  if (error) return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  return NextResponse.json(data);
}
