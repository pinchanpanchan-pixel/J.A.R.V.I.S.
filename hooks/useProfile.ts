"use client";
import { useAuth } from "@/components/providers/AuthProvider";
import { featuresFor } from "@/lib/plans";
import { useRow } from "./useTable";

/** Perfil + memoria esencial + voz + features del plan del usuario actual. */
export function useProfile() {
  const { user } = useAuth();
  const profile = useRow("users", user?.id);
  const core = useRow("user_core_memory", user?.id);
  const voice = useRow("voice_prefs", user?.id);
  const features = featuresFor(profile?.subscription, profile?.is_owner);
  return {
    user,
    profile,
    core,
    voice,
    features,
    isOwner: !!profile?.is_owner,
    assistantName: core?.assistant_name || "J.A.R.V.I.S.",
    userName: core?.user_name || "hermano",
  };
}
