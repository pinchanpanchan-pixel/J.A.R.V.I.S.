import { describe, it, expect } from "vitest";
import { memoryKVFactory } from "@/lib/sync/kv";
import { MockRemote } from "@/lib/sync/mockRemote";
import { mockCodes, mockDeleteCode, mockPay, mockRedeem, mockUpsertCode, mockFounderSlotsLeft } from "@/lib/mock/payments";

const U = "33333333-3333-4333-8333-333333333333";
async function cloudWithUser() {
  const cloud = new MockRemote(memoryKVFactory());
  const now = new Date().toISOString();
  await cloud.pushAsBackend("users", { id: U, user_id: U, email: "a@b.c", is_owner: false, subscription: "free", subscription_period: null, updated_at: now, created_at: now } as never);
  return cloud;
}
const code = async (cloud: MockRemote, c: string) => (await mockCodes(cloud)).find((x) => x.code === c)!;

describe("pagos simulados", () => {
  it("siembra los 4 códigos de la especificación", async () => {
    const cloud = await cloudWithUser();
    expect((await mockCodes(cloud)).map((c) => `${c.code}:${c.percent_off}:${c.max_uses ?? "∞"}`).sort()).toEqual(["BROTHER50:50:100", "FRIENDS20:20:200", "LAUNCH30:30:500", "PANCHAN100:100:∞"]);
  });

  it("PANCHAN100 => pro_lifetime + propietario, sin pasarela, una sola vez", async () => {
    const cloud = await cloudWithUser();
    const r = await mockRedeem(cloud, U, "panchan100");
    expect(r).toMatchObject({ ok: true, applied: true, plan: "pro_lifetime" });
    const u = await cloud.getRow("users", U);
    expect(u?.subscription).toBe("pro_lifetime");
    expect(u?.is_owner).toBe(true);
    expect((await code(cloud, "PANCHAN100")).used_count).toBe(1);
    expect(await mockRedeem(cloud, U, "PANCHAN100")).toEqual({ ok: false, error: "already_redeemed" });
  });

  it("código parcial: se valida sin consumir; se consume al pagar", async () => {
    const cloud = await cloudWithUser();
    expect(await mockRedeem(cloud, U, "BROTHER50")).toMatchObject({ ok: true, percent_off: 50, applied: false });
    expect((await code(cloud, "BROTHER50")).used_count).toBe(0);
    await mockPay(cloud, U, "pro", "monthly", 1450, "BROTHER50", "stripe");
    expect((await cloud.getRow("users", U))?.subscription).toBe("pro");
    expect((await code(cloud, "BROTHER50")).used_count).toBe(1);
    expect(await mockRedeem(cloud, U, "BROTHER50")).toEqual({ ok: false, error: "already_redeemed" });
  });

  it("código inválido", async () => {
    expect(await mockRedeem(await cloudWithUser(), U, "NOEXISTE")).toEqual({ ok: false, error: "invalid_code" });
  });

  it("panel del propietario: crear, desactivar, borrar", async () => {
    const cloud = await cloudWithUser();
    await mockCodes(cloud);
    await mockUpsertCode(cloud, { code: "vip40", percent_off: 40, max_uses: 5, valid_until: null });
    expect(await mockRedeem(cloud, U, "VIP40")).toMatchObject({ ok: true, percent_off: 40 });
    await mockUpsertCode(cloud, { code: "FRIENDS20", is_active: false });
    expect(await mockRedeem(cloud, U, "FRIENDS20")).toEqual({ ok: false, error: "invalid_code" });
    await mockDeleteCode(cloud, await code(cloud, "LAUNCH30"));
    expect((await mockCodes(cloud)).map((c) => c.code)).not.toContain("LAUNCH30");
  });

  it("plazas Founder", async () => {
    const cloud = await cloudWithUser();
    expect(await mockFounderSlotsLeft(cloud)).toBe(500);
    await mockPay(cloud, U, "founder", "lifetime", 19900, null, "paypal");
    expect(await mockFounderSlotsLeft(cloud)).toBe(499);
  });
});
