import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { secret } from "@/lib/serverEnv";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { activatePlan, stripeClient } from "@/lib/payments/server";
import type { Plan, Period } from "@/types/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Webhook de Stripe (firma verificada). Es la ÚNICA vía que activa planes pagados con Stripe. */
export async function POST(req: Request) {
  const s = stripeClient();
  const whSecret = secret("STRIPE_WEBHOOK_SECRET");
  const admin = getSupabaseAdmin();
  if (!s || !whSecret || !admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await s.webhooks.constructEventAsync(await req.text(), sig, whSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "invoice.paid": {
      const inv = event.data.object;
      const details = inv.parent?.subscription_details;
      const md = (details?.metadata ?? {}) as Record<string, string>;
      if (!md.user_id) break;
      const subId = typeof details?.subscription === "string" ? details.subscription : details?.subscription?.id ?? null;
      const periodEndTs = inv.lines?.data?.[0]?.period?.end;
      await activatePlan(admin, md.user_id, {
        plan: md.plan as Plan,
        period: md.period as Period,
        provider: "stripe",
        providerRef: `${subId}:${inv.id}`,
        amountCents: inv.amount_paid,
        code: inv.billing_reason === "subscription_create" && md.code ? md.code : null,
        renewsAt: periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null,
      });
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      if (pi.metadata?.kind !== "founder" || !pi.metadata.user_id) break;
      await activatePlan(admin, pi.metadata.user_id, {
        plan: "founder",
        period: "lifetime",
        provider: "stripe",
        providerRef: pi.id,
        amountCents: pi.amount_received,
        code: pi.metadata.code || null,
        renewsAt: null,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (!userId) break;
      const { data: u } = await admin.from("users").select("is_owner, subscription").eq("id", userId).single();
      // Nunca se degrada al propietario ni a planes de por vida
      if (u && !u.is_owner && !["founder", "pro_lifetime"].includes(u.subscription)) {
        await admin.from("users").update({ subscription: "free", subscription_period: null, subscription_status: "canceled", subscription_renews_at: null }).eq("id", userId);
      }
      await admin.from("subscriptions").update({ status: "canceled" }).like("provider_subscription_id", `${sub.id}:%`);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
