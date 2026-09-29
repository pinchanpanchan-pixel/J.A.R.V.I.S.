import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { activatePlan, codeForUser, paypalCapture, quote } from "@/lib/payments/server";
import { periodEnd } from "@/lib/payments/request";
import type { Period } from "@/types/db";

export const dynamic = "force-dynamic";

/** Captura el pedido y, si PayPal confirma el importe correcto para ESTE usuario, activa el plan. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const parsed = z.object({ orderId: z.string().max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const cap = await paypalCapture(parsed.data.orderId);
  if (!cap.ok || !cap.customId) return NextResponse.json({ error: "capture_failed" }, { status: 402 });
  const [uid, plan, period, codeStr] = cap.customId.split("|");
  if (uid !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const code = await codeForUser(admin, user.id, codeStr || null);
  const expected = quote(plan as "pro", period as Period, code).firstChargeCents;
  if (cap.amountCents < expected) return NextResponse.json({ error: "amount_mismatch" }, { status: 402 });
  await activatePlan(admin, user.id, {
    plan: plan as "pro",
    period: period as Period,
    provider: "paypal",
    providerRef: parsed.data.orderId,
    amountCents: cap.amountCents,
    code: code?.code ?? null,
    renewsAt: periodEnd(period as Period),
  });
  return NextResponse.json({ ok: true, plan, period });
}
