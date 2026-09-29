import { Crown } from "lucide-react";
import { PLAN_LABELS } from "@/lib/plans";
import type { Plan } from "@/types/db";

/** Insignia dorada «OWNER - Lifetime» para el propietario; plan normal para el resto. */
export function PlanBadge({ isOwner, plan }: { isOwner: boolean; plan: Plan }) {
  if (isOwner)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F5C451] to-[#E0A526] px-3 py-1 text-[11px] font-bold tracking-wide text-[#3A2A05] shadow-[0_4px_20px_rgba(245,196,81,.35)]">
        <Crown className="h-3.5 w-3.5" /> OWNER - Lifetime
      </span>
    );
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${plan === "free" ? "bg-white/10 text-white/70" : "bg-arc/15 text-arc"}`}>
      {PLAN_LABELS[plan]}
    </span>
  );
}
