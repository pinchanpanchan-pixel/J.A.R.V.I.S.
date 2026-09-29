import { describe, it, expect } from "vitest";
import { checkCode, quote, grantOf, validateNewCode, formatUsd } from "@/lib/payments/discounts";
import type { DiscountCodeRow } from "@/types/db";

const c = (code: string, percent_off: number, extra: Partial<DiscountCodeRow> = {}): DiscountCodeRow => ({
  id: code, code, percent_off, max_uses: null, used_count: 0, valid_until: null, duration: "forever", grants_plan: null, grants_period: null,
  created_by: "pinchan.panchan@gmail.com", is_active: true, created_at: "", updated_at: "", ...extra,
});
const SEED = [
  c("PANCHAN100", 100, { duration: "lifetime", grants_plan: "pro_lifetime", grants_period: "lifetime" }),
  c("BROTHER50", 50, { max_uses: 100 }),
  c("FRIENDS20", 20, { max_uses: 200 }),
  c("LAUNCH30", 30, { max_uses: 500, duration: "once" }),
];

describe("códigos de descuento", () => {
  it("valida mayúsculas/espacios y rechaza inválidos", () => {
    expect(checkCode(" panchan100 ", SEED, []).ok).toBe(true);
    expect(checkCode("NOEXISTE", SEED, [])).toEqual({ ok: false, error: "invalid_code" });
  });
  it("respeta activo, caducidad y usos máximos", () => {
    expect(checkCode("X", [c("X", 20, { is_active: false })], []).ok).toBe(false);
    expect(checkCode("X", [c("X", 20, { valid_until: "2020-01-01T00:00:00Z" })], []).ok).toBe(false);
    expect(checkCode("X", [c("X", 20, { valid_until: "2999-01-01T00:00:00Z" })], []).ok).toBe(true);
    expect(checkCode("X", [c("X", 20, { max_uses: 3, used_count: 3 })], []).ok).toBe(false);
    expect(checkCode("X", [c("X", 20, { max_uses: null, used_count: 99999 })], []).ok).toBe(true);
  });
  it("no se puede canjear dos veces", () => {
    expect(checkCode("BROTHER50", SEED, ["brother50"])).toEqual({ ok: false, error: "already_redeemed" });
  });
  it("PANCHAN100 concede lifetime", () => {
    expect(grantOf(SEED[0])).toEqual({ plan: "pro_lifetime", period: "lifetime" });
  });
  it("precios con descuento: Pro $29/mes, BROTHER50 -> $14.50 siempre; LAUNCH30 solo el primer mes", () => {
    expect(quote("pro", "monthly", null)).toMatchObject({ firstChargeCents: 2900, recurringCents: 2900 });
    expect(quote("pro", "monthly", SEED[1])).toMatchObject({ firstChargeCents: 1450, recurringCents: 1450 });
    expect(quote("pro", "monthly", SEED[3])).toMatchObject({ firstChargeCents: 2030, recurringCents: 2900 });
    expect(quote("founder", "lifetime", SEED[2])).toMatchObject({ baseCents: 19900, firstChargeCents: 15920, recurringCents: null });
    expect(quote("pro_lite", "yearly", null).firstChargeCents).toBe(19000);
    expect(formatUsd(1450)).toBe("$14.50");
    expect(formatUsd(2900)).toBe("$29");
  });
  it("validación del panel del propietario", () => {
    expect(validateNewCode({ code: "VIP40", percent_off: 40, max_uses: 10, valid_until: null })).toBeNull();
    expect(validateNewCode({ code: "x", percent_off: 40, max_uses: null, valid_until: null })).toMatch(/3-40/);
    expect(validateNewCode({ code: "OK1", percent_off: 5, max_uses: null, valid_until: null })).toMatch(/10 y 100/);
    expect(validateNewCode({ code: "OK1", percent_off: 50, max_uses: 0, valid_until: null })).toMatch(/Usos/);
  });
});
