"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Lock, Loader2, Mic } from "lucide-react";
import { openDiary } from "@/lib/api";
import type { DiaryEntryRow } from "@/types/db";

export const EMOTION_EMOJI: Record<string, string> = {
  alegría: "😊", felicidad: "😊", calma: "😌", gratitud: "🙏", orgullo: "💪", amor: "❤️", ilusión: "✨",
  tristeza: "😔", ansiedad: "😰", estrés: "😵", enfado: "😤", miedo: "😨", cansancio: "🥱", frustración: "😣", soledad: "🫥",
};

export function sentimentColor(s: number | null): string {
  if (s === null) return "#64748b";
  if (s > 0.3) return "#34d399";
  if (s < -0.3) return "#f87171";
  return "#fbbf24";
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function Entry({ e }: { e: DiaryEntryRow }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && text === null && e.content_ciphertext) {
      setLoading(true);
      try {
        const [plain] = await openDiary([e.content_ciphertext]);
        setText(plain ?? "No he podido descifrar esta entrada.");
      } catch {
        setText("Necesito conexión para abrir el diario cifrado.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="jv-card overflow-hidden">
      <button onClick={() => void toggle()} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sentimentColor(e.sentiment) }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] text-white/40">
            {e.input_mode === "voice" && <Mic className="h-3 w-3" />}
            {new Date(e.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            <Lock className="h-3 w-3" />
          </div>
          <p className="mt-0.5 text-[14.5px] leading-snug text-white/90">{e.summary ?? "Entrada privada"}</p>
          {(e.emotions.length > 0 || e.tags.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.emotions.map((m) => (
                <span key={m} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-white/75">
                  {EMOTION_EMOJI[m] ?? "•"} {m}
                </span>
              ))}
              {e.tags.map((t) => (
                <span key={t} className="rounded-full bg-arc/10 px-2 py-0.5 text-[11px] text-arc">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 text-sm leading-relaxed text-white/75">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <p className="selectable whitespace-pre-line">{text}</p>}
              {e.key_events.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Momentos clave</div>
                  <ul className="mt-1 list-disc pl-5 text-white/70">
                    {e.key_events.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Línea de tiempo del diario agrupada por fecha (descendente). */
export function DiaryTimeline({ entries }: { entries: DiaryEntryRow[] }) {
  const groups = new Map<string, DiaryEntryRow[]>();
  [...entries]
    .sort((a, b) => (a.entry_date === b.entry_date ? Date.parse(b.created_at) - Date.parse(a.created_at) : a.entry_date < b.entry_date ? 1 : -1))
    .forEach((e) => {
      const g = groups.get(e.entry_date) ?? [];
      g.push(e);
      groups.set(e.entry_date, g);
    });
  return (
    <div className="flex flex-col gap-6">
      {Array.from(groups.entries()).map(([date, list]) => (
        <section key={date}>
          <h2 className="mb-2 text-[13px] font-semibold capitalize text-white/55">{dayLabel(date)}</h2>
          <div className="flex flex-col gap-2">
            {list.map((e) => (
              <Entry key={e.id} e={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
