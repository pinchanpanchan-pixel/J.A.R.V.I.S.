"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Ticket } from "lucide-react";
import { useSync } from "@/components/providers/SyncProvider";
import { useProfile } from "@/hooks/useProfile";
import { redeemCode } from "@/lib/payments/client";
import { CODE_ERRORS } from "@/lib/payments/discounts";

export interface AppliedDiscount {
  code: string;
  percentOff: number;
  duration?: string;
}

/**
 * «Tengo código de descuento». Si el código es del 100 % se activa el plan directamente
 * (sin pasar por Stripe); si no, se aplica al pago.
 */
export function DiscountInput({ onApplied, onUnlocked }: { onApplied: (d: AppliedDiscount | null) => void; onUnlocked: () => void }) {
  const { mockCloud } = useSync();
  const { user } = useProfile();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = async () => {
    if (!user || !code.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = await redeemCode(code, mockCloud, user.id);
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: CODE_ERRORS[r.error] ?? "Código no válido" });
      onApplied(null);
      return;
    }
    if (r.applied) {
      setMsg({ ok: true, text: "Código aplicado, bienvenido hermano" });
      setTimeout(onUnlocked, 900);
      return;
    }
    setMsg({ ok: true, text: `Código ${r.code}: −${r.percent_off} %${r.duration === "once" ? " el primer pago" : ""}` });
    onApplied({ code: r.code, percentOff: r.percent_off, duration: r.duration });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-sm text-white/55 underline-offset-4 hover:text-white hover:underline">
          Tengo código de descuento
        </button>
      ) : (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="w-full">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  className="jv-input pl-11 uppercase"
                  placeholder="¿Tienes código?"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && void apply()}
                  autoCapitalize="characters"
                  autoFocus
                  aria-label="Código de descuento"
                />
              </div>
              <button type="button" onClick={() => void apply()} disabled={busy || !code.trim()} className="jv-btn-ghost px-4">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
      {msg && (
        <p role="status" className={`flex items-center gap-1 text-sm ${msg.ok ? "text-arc" : "text-red-300"}`}>
          {msg.ok && <Check className="h-4 w-4" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
