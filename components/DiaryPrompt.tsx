"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BookHeart, X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useTable } from "@/hooks/useTable";
import { localDate } from "@/lib/dates";

const DISMISS_KEY = "jarvis.diaryPromptDismissed";

/**
 * Recordatorio del diario dentro de la app: a partir de la hora elegida, si hoy no hay
 * entrada, aparece «Hermano, ¿cómo fue hoy?». Con la app cerrada llega por push (Edge Function).
 */
export function DiaryPrompt() {
  const { profile, features, userName } = useProfile();
  const { rows } = useTable("diary_entries");
  const router = useRouter();
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (!features.diary || !profile?.diary_reminder_time) return;
    const check = () => {
      const [h, m] = profile.diary_reminder_time!.split(":").map(Number);
      const now = new Date();
      const today = localDate(now);
      const written = rows.some((r) => r.entry_date === today);
      let dismissed = "";
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) ?? "";
      } catch {
        /* nada */
      }
      const isDue = now.getHours() * 60 + now.getMinutes() >= h * 60 + m && !written && dismissed !== today;
      setDue(isDue);
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [features.diary, profile?.diary_reminder_time, rows]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, localDate());
    } catch {
      /* nada */
    }
    setDue(false);
  };

  return (
    <AnimatePresence>
      {due && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+150px)] z-30 mx-auto max-w-[420px] rounded-3xl border border-arc/30 bg-navy-800/95 p-4 shadow-card backdrop-blur-xl"
          role="dialog"
          aria-label="Recordatorio del diario"
        >
          <div className="flex items-start gap-3">
            <BookHeart className="mt-0.5 h-5 w-5 shrink-0 text-arc" />
            <div className="flex-1">
              <p className="font-semibold">{userName === "hermano" ? "Hermano" : userName}, ¿cómo fue hoy?</p>
              <p className="text-xs text-white/55">Cuéntamelo con la voz o escribiendo. Lo guardo cifrado.</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    dismiss();
                    router.push("/diary?write=1");
                  }}
                  className="jv-btn-primary px-4 py-2 text-sm"
                >
                  Contártelo
                </button>
                <button onClick={dismiss} className="jv-btn-ghost px-4 py-2 text-sm">
                  Luego
                </button>
              </div>
            </div>
            <button onClick={dismiss} aria-label="Cerrar" className="text-white/40">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
