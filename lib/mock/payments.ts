"use client";
import type { MockRemote } from "@/lib/sync/mockRemote";
import type { AnyRow } from "@/lib/sync/remote";
import { nowIso, stableId, uuid } from "@/lib/ids";
import { checkCode, grantOf, normalizeCode } from "@/lib/payments/discounts";
import type { DiscountCodeRow, Plan, Period, TableName } from "@/types/db";

/** Backend de pagos SIMULADO (modo sin claves). Replica redeem_discount_code / consume_discount_code. */
const T = (n: string) => n as TableName;
const OWNER = "pinchan.panchan@gmail.com";

/** Códigos solo para propietarios (como discount_codes.owners_only en la base de datos). */
export const OWNERS_ONLY_CODES = new Set(["PANCHAN100"]);

const SEED: Array<Pick<DiscountCodeRow, "code" | "percent_off" | "max_uses" | "duration" | "grants_plan" | "grants_period">> = [
  { code: "PANCHAN100", percent_off: 100, max_uses: null, duration: "lifetime", grants_plan: "pro_lifetime", grants_period: "lifetime" },
  { code: "BROTHER50", percent_off: 50, max_uses: 100, duration: "forever", grants_plan: null, grants_period: null },
  { code: "FRIENDS20", percent_off: 20, max_uses: 200, duration: "forever", grants_plan: null, grants_period: null },
  { code: "LAUNCH30", percent_off: 30, max_uses: 500, duration: "once", grants_plan: null, grants_period: null },
];

export async function mockCodes(cloud: MockRemote): Promise<DiscountCodeRow[]> {
  let rows = (await cloud.listAll(T("discount_codes"))) as unknown as DiscountCodeRow[];
  if (rows.length === 0) {
    for (const s of SEED) {
      await cloud.pushAsBackend(T("discount_codes"), {
        id: stableId("code", s.code),
        user_id: undefined as unknown as string,
        ...s,
        used_count: 0,
        valid_until: null,
        created_by: OWNER,
        is_active: true,
        created_at: nowIso(),
        updated_at: nowIso(),
      } as unknown as AnyRow);
    }
    rows = (await cloud.listAll(T("discount_codes"))) as unknown as DiscountCodeRow[];
  }
  return rows.filter((r) => !(r as unknown as { deleted_at?: string }).deleted_at);
}

async function redeemedBy(cloud: MockRemote, userId: string): Promise<string[]> {
  return (await cloud.listAll(T("discount_redemptions"))).filter((r) => r.user_id === userId).map((r) => String(r.code));
}

async function consume(cloud: MockRemote, userId: string, c: DiscountCodeRow) {
  await cloud.pushAsBackend(T("discount_codes"), { ...(c as unknown as AnyRow), used_count: c.used_count + 1, updated_at: nowIso() });
  await cloud.pushAsBackend(T("discount_redemptions"), { id: stableId(userId, "redeem", c.code), user_id: userId, code: c.code, redeemed_at: nowIso(), updated_at: nowIso() } as unknown as AnyRow);
}

export async function mockActivate(cloud: MockRemote, userId: string, plan: Plan, period: Period, provider: "stripe" | "paypal" | "code" | "mock", amountCents: number, code: DiscountCodeRow | null, owner = false) {
  const user = await cloud.getRow("users", userId);
  await cloud.pushAsBackend("subscriptions", {
    id: uuid(),
    user_id: userId,
    plan,
    period,
    status: "active",
    provider,
    provider_subscription_id: null,
    discount_code: code?.code ?? null,
    amount_cents: amountCents,
    currency: "usd",
    current_period_end: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  } as unknown as AnyRow);
  if (user) {
    const keepOwner = !!user.is_owner;
    await cloud.pushAsBackend("users", {
      ...user,
      subscription: keepOwner ? user.subscription : plan,
      subscription_period: keepOwner ? user.subscription_period : period,
      subscription_status: "active",
      is_owner: keepOwner || owner,
      updated_at: nowIso(),
    });
  }
}

export type RedeemResult = { ok: false; error: string } | { ok: true; code: string; percent_off: number; applied: boolean; plan?: Plan; duration?: string };

export async function mockRedeem(cloud: MockRemote, userId: string, input: string): Promise<RedeemResult> {
  const r = checkCode(input, await mockCodes(cloud), await redeemedBy(cloud, userId));
  if (!r.ok) return r;
  // El propietario lo decide el servidor (por email) al entrar; aquí solo se lee la marca.
  if (OWNERS_ONLY_CODES.has(r.code.code) && !(await cloud.getRow("users", userId))?.is_owner) return { ok: false, error: "invalid_code" };
  if (r.code.percent_off < 100) return { ok: true, code: r.code.code, percent_off: r.code.percent_off, applied: false, duration: r.code.duration };
  const g = grantOf(r.code);
  await consume(cloud, userId, r.code);
  await mockActivate(cloud, userId, g.plan, g.period, "code", 0, r.code);
  return { ok: true, code: r.code.code, percent_off: 100, applied: true, plan: g.plan };
}

/** Pago simulado completado (lo que en producción hace el webhook). */
export async function mockPay(cloud: MockRemote, userId: string, plan: Plan, period: Period, amountCents: number, codeInput: string | null, provider: "stripe" | "paypal") {
  let code: DiscountCodeRow | null = null;
  if (codeInput) {
    const r = checkCode(codeInput, await mockCodes(cloud), await redeemedBy(cloud, userId));
    if (r.ok) code = r.code;
  }
  await mockActivate(cloud, userId, plan, period, provider, amountCents, code);
  if (code) await consume(cloud, userId, code);
}

export async function mockFounderSlotsLeft(cloud: MockRemote): Promise<number> {
  return Math.max(0, 500 - (await cloud.listAll("subscriptions")).filter((s) => s.plan === "founder" && s.status === "active").length);
}

// --- Panel del propietario (CRUD) en modo simulado
export async function mockUpsertCode(cloud: MockRemote, row: Partial<DiscountCodeRow> & { code: string }) {
  const code = normalizeCode(row.code);
  const existing = (await mockCodes(cloud)).find((c) => c.code === code);
  await cloud.pushAsBackend(T("discount_codes"), {
    ...(existing ?? { id: stableId("code", code), used_count: 0, created_at: nowIso(), created_by: OWNER, duration: "forever", grants_plan: null, grants_period: null, is_active: true }),
    ...row,
    code,
    updated_at: nowIso(),
  } as unknown as AnyRow);
}

export async function mockDeleteCode(cloud: MockRemote, code: DiscountCodeRow) {
  await cloud.pushAsBackend(T("discount_codes"), { ...(code as unknown as AnyRow), deleted_at: nowIso(), is_active: false, updated_at: nowIso() });
}
