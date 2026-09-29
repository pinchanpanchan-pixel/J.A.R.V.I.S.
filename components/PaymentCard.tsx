"use client";
import { useState } from "react";
import { Check, Crown } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { PRICES, PLAN_LABELS } from "@/lib/plans";
import type { Plan } from "@/types/db";

export const PRO_BENEFITS = [
  "Memoria infinita: lo sabe todo de ti",
  "Sincronización en todos tus dispositivos",
  "Las 4 voces premium",
  "Todas tus apps y tu hogar inteligente",
  "Diario privado cifrado",
  "WorldMonitor: te avisa si pasa algo cerca",
  "Modo flotante, atajos y multi-IA",
];

type PaidPlan = Exclude<Plan, "free" | "pro_lifetime">;

/**
 * Tarjeta de pago. Fase 2: selección de plan.
 * Fase 5: Apple Pay (principal), PayPal, tarjeta, Google Pay y códigos de descuento.
 */
export function PaymentCard({ onContinueFree }: { onContinueFree?: () => void }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [plan, setPlan] = useState<PaidPlan>("pro");
  const options = PRICES.filter((p) => p.period === period || p.plan === "founder");

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1.5">
        {PRO_BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-white/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-arc" /> {b}
          </li>
        ))}
      </ul>
      <Segmented
        id="period"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "monthly", label: "Mensual" },
          { value: "yearly", label: "Anual · 2 meses gratis" },
        ]}
      />
      <div className="flex flex-col gap-2">
        {options.map((p) => {
          const active = plan === p.plan;
          return (
            <button
              key={`${p.plan}-${p.period}`}
              type="button"
              onClick={() => setPlan(p.plan)}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                active ? "border-arc bg-arc/10" : "border-white/10 bg-white/[0.04]"
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                {p.plan === "founder" && <Crown className="h-4 w-4 text-gold" />}
                {PLAN_LABELS[p.plan]}
                {p.plan === "pro" && <span className="rounded-full bg-arc px-2 py-0.5 text-[10px] font-bold text-navy-900">RECOMENDADO</span>}
              </span>
              <span className="text-sm text-white/70">{p.label}</span>
            </button>
          );
        })}
      </div>
      {onContinueFree && (
        <button type="button" onClick={onContinueFree} className="text-center text-sm text-white/50 underline-offset-4 hover:underline">
          Seguir con el plan Free
        </button>
      )}
    </div>
  );
}
