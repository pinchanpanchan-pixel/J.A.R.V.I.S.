"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { StyledDot } from "@/components/StyleDots";
import { useProfile } from "@/hooks/useProfile";
import { useProfileActions } from "@/hooks/useProfileActions";
import { STYLES, canUseStyle } from "@/lib/styles";
import type { UiStyle } from "@/types/db";

/**
 * Elegir estilo (configuración inicial y Ajustes). Cada tarjeta enseña su fondo y su bolita
 * en vivo. Los de pago salen con candado en las cuentas gratis; los propietarios tienen todo.
 */
export function StylePicker() {
  const { profile, isOwner } = useProfile();
  const { updateProfile } = useProfileActions();
  const [msg, setMsg] = useState<string | null>(null);
  const value = (profile?.ui_style ?? "actual") as UiStyle;

  const choose = (id: UiStyle) => {
    if (!canUseStyle(id, profile?.subscription, isOwner)) {
      setMsg("Constelación y Pulso de luz vienen con los planes de pago.");
      return;
    }
    setMsg(null);
    void updateProfile({ ui_style: id });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3" role="radiogroup" aria-label="Estilo">
        {STYLES.map((s) => {
          const selected = value === s.id;
          const locked = !canUseStyle(s.id, profile?.subscription, isOwner);
          return (
            <motion.button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Estilo ${s.name}${locked ? " (de pago)" : ""}`}
              whileTap={{ scale: 0.98 }}
              onClick={() => choose(s.id)}
              className={`flex items-center gap-4 overflow-hidden rounded-3xl border p-3 text-left transition ${selected ? "border-arc/60 ring-2 ring-arc/40" : "border-white/10"}`}
              data-testid={`style-${s.id}`}
              data-locked={locked || undefined}
            >
              <div className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ background: s.preview.bg }} aria-hidden>
                <StyledDot style={s.id} mode="idle" size={44} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold" style={{ fontFamily: s.id === "constelacion" ? "var(--font-serif), Georgia, serif" : undefined }}>
                    {s.name}
                  </span>
                  {s.paid ? (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">PRO</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">GRATIS</span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] leading-snug text-white/55">{s.description}</p>
              </div>
              {selected ? (
                <Check className="h-5 w-5 shrink-0 text-arc" />
              ) : locked ? (
                <Lock className="h-4 w-4 shrink-0 text-white/40" />
              ) : null}
            </motion.button>
          );
        })}
      </div>
      {msg && (
        <p role="status" className="text-center text-sm text-gold/90">
          {msg}
        </p>
      )}
    </div>
  );
}
