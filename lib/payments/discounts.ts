import type { DiscountCodeRow, Plan, Period } from "@/types/db";
import { PRICES } from "@/lib/plans";

/** Reglas de validación de códigos (idénticas a public.redeem_discount_code en SQL). */
export type CodeCheck =
  | { ok: true; code: DiscountCodeRow }
  | { ok: false; error: "invalid_code" | "already_redeemed" };

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function checkCode(input: string, codes: DiscountCodeRow[], redeemedByUser: string[], now = new Date()): CodeCheck {
  const code = normalizeCode(input);
  const c = codes.find((x) => x.code === code);
  if (!c || !c.is_active) return { ok: false, error: "invalid_code" };
  if (c.valid_until && Date.parse(c.valid_until) <= now.getTime()) return { ok: false, error: "invalid_code" };
  if (c.max_uses !== null && c.used_count >= c.max_uses) return { ok: false, error: "invalid_code" };
  if (redeemedByUser.map(normalizeCode).includes(code)) return { ok: false, error: "already_redeemed" };
  return { ok: true, code: c };
}

/** Plan que concede un código del 100 % (por defecto: de por vida). */
export function grantOf(c: DiscountCodeRow): { plan: Plan; period: Period } {
  return { plan: c.grants_plan ?? "pro_lifetime", period: c.grants_period ?? "lifetime" };
}

export interface Quote {
  plan: Exclude<Plan, "free" | "pro_lifetime">;
  period: Period;
  baseCents: number;
  /** Primer cobro con el descuento aplicado. */
  firstChargeCents: number;
  /** Cobros siguientes (el código «once» solo descuenta el primero). */
  recurringCents: number | null;
  percentOff: number;
  label: string;
}

export function priceFor(plan: Quote["plan"], period: Period) {
  const p = PRICES.find((x) => x.plan === plan && (plan === "founder" ? true : x.period === period));
  if (!p) throw new Error(`precio no definido: ${plan}/${period}`);
  return p;
}

export function quote(plan: Quote["plan"], period: Period, code: DiscountCodeRow | null): Quote {
  const p = priceFor(plan, period);
  const pct = code?.percent_off ?? 0;
  const discounted = Math.round((p.amountCents * (100 - pct)) / 100);
  const recurring = p.period === "lifetime" ? null : code?.duration === "once" ? p.amountCents : discounted;
  return { plan, period: p.period, baseCents: p.amountCents, firstChargeCents: discounted, recurringCents: recurring, percentOff: pct, label: p.label };
}

export const formatUsd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

export const CODE_ERRORS: Record<string, string> = {
  invalid_code: "Código no válido",
  already_redeemed: "Ya usaste este código, hermano.",
  not_authenticated: "Inicia sesión para usar el código.",
};

/** Validación del formulario de creación de códigos (panel del propietario). */
export function validateNewCode(input: { code: string; percent_off: number; max_uses: number | null; valid_until: string | null }): string | null {
  const code = normalizeCode(input.code);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return "El código debe tener 3-40 letras, números, - o _.";
  if (!Number.isInteger(input.percent_off) || input.percent_off < 10 || input.percent_off > 100) return "El descuento debe estar entre 10 y 100.";
  if (input.max_uses !== null && (!Number.isInteger(input.max_uses) || input.max_uses < 1)) return "Usos máximos: un número mayor que 0 o vacío (ilimitado).";
  if (input.valid_until && Number.isNaN(Date.parse(input.valid_until))) return "Fecha de caducidad no válida.";
  return null;
}
