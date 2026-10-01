"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { DictateButton } from "@/components/DictateButton";
import { useSync } from "@/components/providers/SyncProvider";

export const QUICK_NOTE_EVENT = "jarvis:quick-note";

/** Abre la nota rápida desde cualquier sitio (skill, atajo, voz). */
export function openQuickNote(prefill?: string) {
  window.dispatchEvent(new CustomEvent(QUICK_NOTE_EVENT, { detail: { prefill } }));
}

export async function saveQuickNote(engine: NonNullable<ReturnType<typeof useSync>["engine"]>, content: string, source = "manual") {
  return engine.insert("quick_notes", { content: content.trim(), category: "quick_notes", pinned: false, source });
}

/** Hoja de nota rápida (se abre desde el círculo de la barra de abajo). Sin título: se guarda al instante. */
export function QuickNoteSheet() {
  const { engine } = useSync();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const prefill = (e as CustomEvent<{ prefill?: string }>).detail?.prefill;
      if (prefill) setText(prefill);
      setOpen(true);
    };
    window.addEventListener(QUICK_NOTE_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_NOTE_EVENT, onOpen);
  }, []);

  // Atajo del icono de la app (manifest) y notificaciones: ?action=quick-note / ?action=note
  useEffect(() => {
    const a = params.get("action");
    if (a === "quick-note" || a === "note") {
      setOpen(true);
      router.replace(window.location.pathname);
    }
  }, [params, router]);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 150);
  }, [open]);

  const save = async () => {
    if (!engine || !text.trim()) return;
    await saveQuickNote(engine, text);
    setSaved(true);
    setText("");
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 650);
  };

  return (
    <>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nota rápida">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          }}
          rows={5}
          placeholder="Suelta lo que tengas en la cabeza…"
          className="jv-input resize-none"
        />
        <div className="mt-2 flex items-start justify-between gap-3">
          <DictateButton compact onText={(t) => setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
          <span className="pt-2 text-[11px] text-white/35">Escribe o dicta, como prefieras.</span>
        </div>
        <button onClick={() => void save()} disabled={!text.trim() && !saved} className="jv-btn-primary mt-3 w-full">
          {saved ? (
            <>
              <Check className="h-5 w-5" /> Guardada
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </Sheet>
    </>
  );
}
