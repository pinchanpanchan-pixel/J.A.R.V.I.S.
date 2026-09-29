"use client";
import { apiJson } from "@/lib/api";
import { isMockMode } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { MockRemote } from "@/lib/sync/mockRemote";
import type { DiscountCodeRow } from "@/types/db";
import { mockCodes, mockDeleteCode, mockFounderSlotsLeft, mockRedeem, mockUpsertCode, type RedeemResult } from "@/lib/mock/payments";

export interface PaymentsConfig {
  mock: boolean;
  stripe: { publishableKey: string } | null;
  paypal: { clientId: string } | null;
  founderSlotsLeft: number;
}

export async function getPaymentsConfig(cloud: MockRemote | null): Promise<PaymentsConfig> {
  const cfg = await apiJson<PaymentsConfig>("/api/payments/config");
  if (isMockMode && cloud) cfg.founderSlotsLeft = await mockFounderSlotsLeft(cloud);
  return cfg;
}

/** Canjea/valida un código. 100 % => plan activado sin pasar por la pasarela. */
export async function redeemCode(code: string, cloud: MockRemote | null, userId: string): Promise<RedeemResult> {
  if (isMockMode && cloud) return mockRedeem(cloud, userId, code);
  try {
    return await apiJson<RedeemResult>("/api/payments/code", { method: "POST", body: JSON.stringify({ code }) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invalid_code" };
  }
}

// --- Panel del propietario
export async function listCodes(cloud: MockRemote | null): Promise<DiscountCodeRow[]> {
  if (isMockMode && cloud) return (await mockCodes(cloud)).sort((a, b) => a.code.localeCompare(b.code));
  const { data, error } = await getSupabaseBrowser()!.from("discount_codes").select("*").order("code");
  if (error) throw new Error(error.message);
  return data as DiscountCodeRow[];
}

export async function saveCode(cloud: MockRemote | null, row: Partial<DiscountCodeRow> & { code: string }, ownerEmail: string) {
  if (isMockMode && cloud) return mockUpsertCode(cloud, row);
  const sb = getSupabaseBrowser()!;
  const { error } = row.id
    ? await sb.from("discount_codes").update(row).eq("id", row.id)
    : await sb.from("discount_codes").insert({ ...row, created_by: ownerEmail });
  if (error) throw new Error(error.code === "23505" ? "Ese código ya existe." : error.message);
}

export async function deleteCode(cloud: MockRemote | null, code: DiscountCodeRow) {
  if (isMockMode && cloud) return mockDeleteCode(cloud, code);
  const sb = getSupabaseBrowser()!;
  // Si ya se usó, se desactiva (las redenciones lo referencian); si no, se borra.
  const { error } = code.used_count > 0 ? await sb.from("discount_codes").update({ is_active: false }).eq("id", code.id) : await sb.from("discount_codes").delete().eq("id", code.id);
  if (error) throw new Error(error.message);
}
