import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOwner } from "@/lib/owner";
import { serverEnv } from "@/lib/serverEnv";
import type { EnsureProfileResult } from "./types";

/**
 * Se ejecuta en el callback de auth y en cada arranque de sesión.
 * Propietario = email en la lista (lib/owner.ts + OWNER_EMAILS):
 *   users.is_owner = true, users.subscription = 'pro_lifetime' → nunca ve el muro de pago.
 * Si una cuenta tenía la marca y ya no está en la lista, la pierde (conserva su plan).
 */
export async function ensureProfile(
  admin: SupabaseClient,
  user: { id: string; email: string },
): Promise<EnsureProfileResult> {
  const owner = isOwner({ email: user.email, ownerEmails: serverEnv.ownerEmails });

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
  } else {
    await admin.from("users").update({ is_owner: false }).eq("id", user.id).eq("is_owner", true);
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
export function computeOwnerProfile(email: string): EnsureProfileResult {
  const owner = isOwner({ email, ownerEmails: serverEnv.ownerEmails });
  return owner
    ? { is_owner: true, subscription: "pro_lifetime", subscription_period: "lifetime" }
    : { is_owner: false, subscription: "free", subscription_period: null };
}
