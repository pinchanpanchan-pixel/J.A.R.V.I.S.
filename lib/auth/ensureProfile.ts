import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOwner } from "@/lib/owner";
import { serverEnv } from "@/lib/serverEnv";
import type { EnsureProfileResult } from "./types";

/**
 * Se ejecuta en el callback de auth y en cada arranque de sesión.
 * Si el usuario es propietario (email en OWNER_EMAILS o canjeó OWNER_DISCOUNT_CODE):
 *   users.is_owner = true, users.subscription = 'pro_lifetime' → nunca ve el muro de pago.
 */
export async function ensureProfile(
  admin: SupabaseClient,
  user: { id: string; email: string },
): Promise<EnsureProfileResult> {
  const { data: redemptions } = await admin
    .from("discount_redemptions")
    .select("code")
    .eq("user_id", user.id);

  const owner = isOwner({
    email: user.email,
    ownerEmails: serverEnv.ownerEmails,
    ownerCode: serverEnv.ownerDiscountCode,
    redeemedCodes: (redemptions ?? []).map((r: { code: string }) => r.code),
  });

  // Por si el trigger de alta no existiera todavía (migraciones antiguas).
  await admin.from("users").upsert({ id: user.id, email: user.email }, { onConflict: "id", ignoreDuplicates: true });

  if (owner) {
    const { data: current } = await admin.from("users").select("is_owner, subscription").eq("id", user.id).single();
    if (!current?.is_owner || current.subscription !== "pro_lifetime") {
      await admin
        .from("users")
        .update({
          is_owner: true,
          subscription: "pro_lifetime",
          subscription_period: "lifetime",
          subscription_status: "active",
        })
        .eq("id", user.id);
      await admin.from("subscriptions").insert({
        user_id: user.id,
        plan: "pro_lifetime",
        period: "lifetime",
        status: "active",
        provider: "owner",
        amount_cents: 0,
      });
    }
  }

  const { data } = await admin
    .from("users")
    .select("is_owner, subscription, subscription_period")
    .eq("id", user.id)
    .single();

  return {
    is_owner: !!data?.is_owner,
    subscription: data?.subscription ?? "free",
    subscription_period: data?.subscription_period ?? null,
  };
}

/** Versión sin base de datos (modo simulado): solo calcula el estado. */
export function computeOwnerProfile(email: string, redeemedCodes: string[]): EnsureProfileResult {
  const owner = isOwner({
    email,
    ownerEmails: serverEnv.ownerEmails,
    ownerCode: serverEnv.ownerDiscountCode,
    redeemedCodes,
  });
  return owner
    ? { is_owner: true, subscription: "pro_lifetime", subscription_period: "lifetime" }
    : { is_owner: false, subscription: "free", subscription_period: null };
}
