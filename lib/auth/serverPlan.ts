import "server-only";
import { isMockMode } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { featuresFor, type PlanFeatures } from "@/lib/plans";
import type { Plan } from "@/types/db";

/** Plan del usuario leído del servidor (nunca del cliente). En modo simulado: sin límites. */
export async function getServerFeatures(userId: string): Promise<{ features: PlanFeatures; isOwner: boolean; plan: Plan }> {
  if (isMockMode) return { features: featuresFor("pro_lifetime"), isOwner: false, plan: "pro_lifetime" };
  const sb = getSupabaseServer();
  const { data } = (await sb?.from("users").select("subscription, is_owner").eq("id", userId).single()) ?? { data: null };
  const plan = (data?.subscription ?? "free") as Plan;
  return { features: featuresFor(plan, !!data?.is_owner), isOwner: !!data?.is_owner, plan };
}
