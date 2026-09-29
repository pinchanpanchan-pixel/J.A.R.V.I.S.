import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { codeForUser, founderSlotsLeft, paypalConfigured, paypalCreateOrder, quote } from "@/lib/payments/server";
import { CheckoutBody } from "@/lib/payments/request";

export const dynamic = "force-dynamic";

/** Crea un pedido de PayPal (pago del periodo elegido; el importe lo calcula el servidor). */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!paypalConfigured() || !admin) return NextResponse.json({ error: "paypal_not_configured" }, { status: 503 });
  const parsed = CheckoutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { plan } = parsed.data;
  const period = plan === "founder" ? "lifetime" : parsed.data.period;
  const code = await codeForUser(admin, user.id, parsed.data.code);
  if (parsed.data.code && !code) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  if (plan === "founder" && (await founderSlotsLeft(admin)) <= 0) return NextResponse.json({ error: "founder_sold_out" }, { status: 409 });
  const q = quote(plan, period, code);
  const customId = [user.id, plan, period, code?.code ?? ""].join("|");
  const id = await paypalCreateOrder(q.firstChargeCents, customId, `J.A.R.V.I.S. ${q.label}`);
  return NextResponse.json({ orderId: id });
}
