import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { secret } from "@/lib/serverEnv";
import { checkCode, grantOf, quote, type Quote } from "./discounts";
import type { DiscountCodeRow, Plan, Period } from "@/types/db";

let stripe: Stripe | null | undefined;
export function stripeClient(): Stripe | null {
  if (stripe === undefined) {
    const key = secret("STRIPE_SECRET_KEY");
    stripe = key ? new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 }) : null;
  }
  return stripe;
}

const PRICE_ENV: Record<string, string> = {
  "pro_lite:monthly": "STRIPE_PRICE_PRO_LITE_MONTHLY",
  "pro_lite:yearly": "STRIPE_PRICE_PRO_LITE_YEARLY",
  "pro:monthly": "STRIPE_PRICE_PRO_MONTHLY",
  "pro:yearly": "STRIPE_PRICE_PRO_YEARLY",
};

/** Price de Stripe: el de .env o uno creado automáticamente (lookup_key estable). */
export async function ensurePrice(s: Stripe, q: Quote): Promise<string> {
  const fromEnv = secret(PRICE_ENV[`${q.plan}:${q.period}`] ?? "");
  if (fromEnv) return fromEnv;
  const lookup = `jarvis_${q.plan}_${q.period}_${q.baseCents}`;
  const found = await s.prices.list({ lookup_keys: [lookup], limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const product = await s.products.create({ name: `J.A.R.V.I.S. ${q.plan === "pro_lite" ? "Pro Lite" : "Pro"}` });
  const price = await s.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: q.baseCents,
    recurring: { interval: q.period === "yearly" ? "year" : "month" },
    lookup_key: lookup,
  });
  return price.id;
}

/** Cupón de Stripe equivalente al código de descuento. */
export async function ensureCoupon(s: Stripe, c: DiscountCodeRow): Promise<string> {
  const id = `JARVIS_${c.code}_${c.percent_off}_${c.duration}`;
  try {
    await s.coupons.retrieve(id);
  } catch {
    await s.coupons.create({ id, percent_off: c.percent_off, duration: c.duration === "once" ? "once" : "forever", name: c.code });
  }
  return id;
}

/** Busca y valida un código para el usuario (con service_role). */
export async function codeForUser(admin: SupabaseClient, userId: string, code: string | null | undefined): Promise<DiscountCodeRow | null> {
  if (!code) return null;
  const [{ data: codes }, { data: red }] = await Promise.all([
    admin.from("discount_codes").select("*").eq("code", code.trim().toUpperCase()),
    admin.from("discount_redemptions").select("code").eq("user_id", userId),
  ]);
  const r = checkCode(code, (codes ?? []) as DiscountCodeRow[], (red ?? []).map((x: { code: string }) => x.code));
  return r.ok ? r.code : null;
}

export async function founderSlotsLeft(admin: SupabaseClient | null): Promise<number> {
  if (!admin) return 500;
  const { data } = await admin.rpc("founder_slots_left");
  return typeof data === "number" ? data : 500;
}

export interface Activation {
  plan: Plan;
  period: Period;
  provider: "stripe" | "paypal" | "code";
  providerRef: string | null;
  amountCents: number;
  code: string | null;
  renewsAt: string | null;
}

/** Activa el plan (idempotente por provider+referencia) y consume el código de descuento. */
export async function activatePlan(admin: SupabaseClient, userId: string, a: Activation): Promise<void> {
  const { error: subErr } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan: a.plan,
    period: a.period,
    status: "active",
    provider: a.provider,
    provider_subscription_id: a.providerRef,
    discount_code: a.code,
    amount_cents: a.amountCents,
    currency: "usd",
    current_period_end: a.renewsAt,
  });
  // 23505 = ya activado por este mismo pago (webhook repetido): no hacer nada más
  if (subErr && subErr.code === "23505") return;
  if (subErr) throw new Error(subErr.message);
  const { data: user } = await admin.from("users").select("is_owner, subscription").eq("id", userId).single();
  if (!user?.is_owner) {
    await admin
      .from("users")
      .update({ subscription: a.plan, subscription_period: a.period, subscription_status: "active", subscription_renews_at: a.renewsAt })
      .eq("id", userId);
  }
  if (a.code) await admin.rpc("consume_discount_code", { p_user: userId, p_code: a.code });
}

export { quote, grantOf };

// ---------------------------------------------------------------- PayPal
function paypalBase(): string {
  const env = (process.env.PAYPAL_ENV ?? "").trim() || ((secret("PAYPAL_CLIENT_ID") ?? "").startsWith("sb") ? "sandbox" : "live");
  return env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured(): boolean {
  return !!secret("PAYPAL_CLIENT_ID") && !!secret("PAYPAL_SECRET");
}

async function paypalToken(): Promise<string> {
  const auth = Buffer.from(`${secret("PAYPAL_CLIENT_ID")}:${secret("PAYPAL_SECRET")}`).toString("base64");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`paypal_auth_${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function paypalCreateOrder(amountCents: number, customId: string, description: string): Promise<string> {
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { authorization: `Bearer ${await paypalToken()}`, "content-type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: (amountCents / 100).toFixed(2) }, custom_id: customId, description }],
    }),
  });
  if (!res.ok) throw new Error(`paypal_order_${res.status}`);
  return ((await res.json()) as { id: string }).id;
}

export async function paypalCapture(orderId: string): Promise<{ ok: boolean; customId: string | null; amountCents: number }> {
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { authorization: `Bearer ${await paypalToken()}`, "content-type": "application/json" },
  });
  const j = (await res.json()) as {
    status?: string;
    purchase_units?: Array<{ payments?: { captures?: Array<{ status: string; custom_id?: string; amount: { value: string } }> } }>;
  };
  const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
  return { ok: res.ok && j.status === "COMPLETED" && cap?.status === "COMPLETED", customId: cap?.custom_id ?? null, amountCents: Math.round(Number(cap?.amount.value ?? 0) * 100) };
}
