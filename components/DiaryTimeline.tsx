"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation, type PanInfo } from "framer-motion";
import { ChevronDown, Lock, Loader2, Mic, PenLine } from "lucide-react";
import { openDiary } from "@/lib/api";
import { useSync } from "@/components/providers/SyncProvider";
import type { DiaryEntryRow } from "@/types/db";

/** Color del punto = ánimo del día (lo explica la leyenda de la pantalla del diario). */
export function sentimentColor(s: number | null): string {
  if (s === null) return "#64748b";
  if (s > 0.3) return "#34d399";
  if (s < -0.3) return "#f87171";
  return "#fbbf24";
}

export function sentimentLabel(s: number | null): string {
  if (s === null) return "sin analizar";
  if (s > 0.6) return "muy bueno";
  if (s > 0.3) return "bueno";
  if (s < -0.6) return "muy bajo";
  if (s < -0.3) return "bajo";
  return "normal";
}

export const SENTIMENT_LEGEND = [
  { color: "#34d399", label: "Buen día" },
  { color: "#fbbf24", label: "Normal" },
  { color: "#f87171", label: "Día difícil" },
];

function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

const ACTION_W = 96; // ancho del botón «Eliminar» al deslizar

/**
 * Una entrada. Deslizar a la izquierda descubre «Eliminar» (como en Recordatorios de Apple);
 * deslizar del todo la elimina. Al abrirla se ve el texto, el análisis y Editar / Eliminar.
 */
function Entry({ e, onEdit }: { e: DiaryEntryRow; onEdit: (e: DiaryEntryRow, text: string) => void }) {
  const { engine } = useSync();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const controls = useAnimation();
  // Tras arrastrar, el «click» que llega al soltar no debe abrir/cerrar la entrada.
  const draggedAt = useRef(0);

  // Si la entrada cambia (editada en este u otro dispositivo), se vuelve a descifrar.
  useEffect(() => {
    setText(null);
  }, [e.content_ciphertext]);
  useEffect(() => {
    if (open && text === null && e.content_ciphertext) void decrypt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, text, e.content_ciphertext]);

  const decrypt = async (): Promise<string | null> => {
    if (text !== null || !e.content_ciphertext) return text;
    setLoading(true);
    try {
      const [plain] = await openDiary([e.content_ciphertext]);
      const t = plain ?? "No he podido descifrar esta entrada.";
      setText(t);
      return plain;
    } catch {
      setText("Necesito conexión para abrir el diario cifrado.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (Date.now() - draggedAt.current < 350) return;
    if (revealed) return close();
    const next = !open;
    setOpen(next);
    if (next) await decrypt();
  };

  const close = () => {
    setRevealed(false);
    void controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 40 } });
  };

  const remove = async () => {
    await controls.start({ x: -600, opacity: 0, transition: { duration: 0.2 } });
    await engine?.remove("diary_entries", e.id);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    draggedAt.current = Date.now();
    if (info.offset.x < -220) return void remove();
    if (info.offset.x < -50) {
      setRevealed(true);
      void controls.start({ x: -ACTION_W, transition: { type: "spring", stiffness: 500, damping: 40 } });
    } else close();
  };

  const edit = async () => {
    const t = await decrypt();
    if (t !== null) onEdit(e, t);
  };

  return (
    <div className="relative overflow-hidden rounded-card" data-testid="diary-entry">
      {/* Acción que aparece al deslizar */}
      <button
        onClick={() => void remove()}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-[#FF3B30] text-[15px] font-medium text-white"
        style={{ width: ACTION_W }}
        aria-label="Eliminar entrada"
        tabIndex={revealed ? 0 : -1}
      >
        Eliminar
      </button>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTION_W * 3, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        onDragStart={() => (draggedAt.current = Date.now())}
        onDragEnd={onDragEnd}
        animate={controls}
        className="jv-card relative touch-pan-y bg-navy-800"
      >
        {/* div (no <button>): Framer Motion no empieza a arrastrar desde un botón */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => void toggle()}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              void toggle();
            }
          }}
          className="flex w-full cursor-pointer select-none items-start gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-arc/50"
        >
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sentimentColor(e.sentiment) }} title={`Ánimo: ${sentimentLabel(e.sentiment)}`} />
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
                  <span key={m} className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11px] text-white/75">
                    {m}
                  </span>
                ))}
                {e.tags.map((t) => (
                  <span key={t} className="rounded-full bg-arc/10 px-2.5 py-0.5 text-[11px] text-arc">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`} />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="flex flex-col gap-4 border-t border-white/[0.06] px-4 pb-4 pt-3 text-sm leading-relaxed text-white/75">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <p className="selectable whitespace-pre-line">{text}</p>}

                {/* Análisis */}
                <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] p-3.5" data-testid="diary-analysis">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: sentimentColor(e.sentiment) }} />
                    <span className="text-white/55">Ánimo del día:</span>
                    <span className="font-medium text-white/85">{sentimentLabel(e.sentiment)}</span>
                  </div>
                  {e.emotions.length > 0 && <Block title="Emociones" items={e.emotions} inline />}
                  {e.key_events.length > 0 && <Block title="Momentos clave" items={e.key_events} />}
                  {e.thoughts.length > 0 && <Block title="Lo que te ronda la cabeza" items={e.thoughts} />}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => void edit()} className="jv-btn-ghost flex-1 py-2.5 text-sm">
                    <PenLine className="h-4 w-4" /> Editar
                  </button>
                  {confirming ? (
                    <button onClick={() => void remove()} className="jv-btn flex-1 bg-[#FF3B30] py-2.5 text-sm text-white">
                      Confirmar
                    </button>
                  ) : (
                    <button onClick={() => setConfirming(true)} className="jv-btn-ghost flex-1 py-2.5 text-sm text-red-300">
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Block({ title, items, inline = false }: { title: string; items: string[]; inline?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{title}</div>
      {inline ? (
        <p className="mt-1 text-white/75">{items.join(" · ")}</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-white/75">
          {items.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Línea de tiempo del diario agrupada por fecha (descendente). */
export function DiaryTimeline({ entries, onEdit }: { entries: DiaryEntryRow[]; onEdit: (e: DiaryEntryRow, text: string) => void }) {
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
              <Entry key={e.id} e={e} onEdit={onEdit} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
