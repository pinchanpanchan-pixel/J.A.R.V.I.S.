import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { codeForUser, ensureCoupon, ensurePrice, founderSlotsLeft, quote, stripeClient } from "@/lib/payments/server";
import { CheckoutBody } from "@/lib/payments/request";

export const dynamic = "force-dynamic";

/**
 * Prepara el cobro con Stripe (Apple Pay / Google Pay / tarjeta usan el mismo client_secret):
 *  - Pro / Pro Lite: suscripción incompleta (se confirma en el cliente); cupón si hay código.
 *  - Founder: pago único (solo si quedan plazas de los 500).
 */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = stripeClient();
  const admin = getSupabaseAdmin();
  if (!s || !admin) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  const parsed = CheckoutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { plan } = parsed.data;
  const period = plan === "founder" ? "lifetime" : parsed.data.period;
  const code = await codeForUser(admin, user.id, parsed.data.code);
  if (parsed.data.code && !code) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  if (code?.percent_off === 100) return NextResponse.json({ error: "use_code_route" }, { status: 400 });
  if (plan === "founder" && (await founderSlotsLeft(admin)) <= 0) return NextResponse.json({ error: "founder_sold_out" }, { status: 409 });

  const q = quote(plan, period, code);
  const { data: profile } = await admin.from("users").select("stripe_customer_id, email").eq("id", user.id).single();
  let customer = profile?.stripe_customer_id as string | null;
  if (!customer) {
    customer = (await s.customers.create({ email: profile?.email ?? user.email, metadata: { user_id: user.id } })).id;
    await admin.from("users").update({ stripe_customer_id: customer }).eq("id", user.id);
  }
  const metadata = { user_id: user.id, plan, period, code: code?.code ?? "" };

  if (plan === "founder") {
    const pi = await s.paymentIntents.create({
      amount: q.firstChargeCents,
      currency: "usd",
      customer,
      automatic_payment_methods: { enabled: true },
      metadata: { ...metadata, kind: "founder" },
      description: "J.A.R.V.I.S. Founder (de por vida)",
    });
    return NextResponse.json({ clientSecret: pi.client_secret, kind: "payment", amountCents: q.firstChargeCents, label: q.label });
  }

  const sub = await s.subscriptions.create({
    customer,
    items: [{ price: await ensurePrice(s, q) }],
    discounts: code ? [{ coupon: await ensureCoupon(s, code) }] : undefined,
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata,
    expand: ["latest_invoice.confirmation_secret"],
  });
  const invoice = sub.latest_invoice as { confirmation_secret?: { client_secret: string } | null } | null;
  const clientSecret = invoice?.confirmation_secret?.client_secret;
  if (!clientSecret) return NextResponse.json({ error: "no_client_secret" }, { status: 502 });
  return NextResponse.json({ clientSecret, kind: "subscription", subscriptionId: sub.id, amountCents: q.firstChargeCents, label: q.label });
}
