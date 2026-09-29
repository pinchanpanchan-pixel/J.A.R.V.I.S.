"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, NotebookPen } from "lucide-react";

const SLIDES = [
  {
    title: "El punto que respira",
    body: "Cuando respira, estoy atento. Mantén pulsado el botón rojo, da dos palmadas o di mi nombre y te escucho.",
    art: "dot",
  },
  {
    title: "Nota rápida",
    body: "El botón de abajo a la derecha guarda una idea al instante. Sin título, sin rollos. También puedes decir «crea nota rápida».",
    art: "note",
  },
  {
    title: "Bloques de memoria",
    body: "Todo lo importante lo guardo en bloques que puedes buscar y etiquetar. Me acuerdo por ti.",
    art: "memory",
  },
] as const;

function Art({ kind }: { kind: (typeof SLIDES)[number]["art"] }) {
  if (kind === "dot")
    return (
      <div className="relative flex h-36 items-center justify-center">
        <motion.div
          className="h-24 w-24 rounded-full bg-[radial-gradient(circle_at_35%_30%,#C9FFF1,#64FFDA_45%,#137a72)] shadow-[0_0_50px_rgba(100,255,218,.45)]"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    );
  if (kind === "note")
    return (
      <div className="relative flex h-36 items-center justify-center">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-48 rounded-2xl bg-white/10 p-3 text-left text-xs text-white/80">
          Llamar a mamá el domingo 📞
        </motion.div>
        <motion.div
          className="absolute bottom-2 right-10 flex h-12 w-12 items-center justify-center rounded-full bg-arc text-navy-900 shadow-lg"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <NotebookPen className="h-5 w-5" />
        </motion.div>
      </div>
    );
  return (
    <div className="flex h-36 items-center justify-center gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.15 }}
          className="w-20 rounded-xl border border-white/10 bg-white/[0.06] p-2 text-left"
        >
          <Layers className="mb-1 h-3.5 w-3.5 text-arc" />
          <div className="mb-1 h-1.5 w-12 rounded bg-white/40" />
          <div className="h-1.5 w-14 rounded bg-white/15" />
          <div className="mt-1 h-1.5 w-10 rounded bg-white/15" />
        </motion.div>
      ))}
    </div>
  );
}

/** Paso 8: mini tutorial de 3 pantallas dentro de la misma tarjeta. */
export function MiniTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="wait">
        <motion.div key={i} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="text-center">
          <Art kind={s.art} />
          <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/65">{s.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-center gap-1.5">
        {SLIDES.map((_, k) => (
          <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-arc" : "w-1.5 bg-white/25"}`} />
        ))}
      </div>
      <button type="button" className="jv-btn-primary" onClick={() => (i < SLIDES.length - 1 ? setI(i + 1) : onDone())}>
        {i < SLIDES.length - 1 ? "Siguiente" : "Entendido"}
      </button>
    </div>
  );
}

export const SHORTCUT_EXAMPLES = [
  { say: "Abre mis notas", does: "Abre las notas rápidas" },
  { say: "Crea nota rápida", does: "Guarda lo siguiente que digas" },
  { say: "¿Qué hicimos ayer?", does: "Resumen de ayer con tu memoria" },
  { say: "Resume mi día", does: "Agenda + notas + diario" },
  { say: "Apaga todas las luces", does: "Hogar inteligente" },
  { say: "Pon mi música", does: "Spotify" },
];

/** Paso 9: tutorial de atajos. */
export function ShortcutsTutorial({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {SHORTCUT_EXAMPLES.map((e, i) => (
          <motion.li
            key={e.say}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] px-4 py-3"
          >
            <span className="text-sm font-medium text-white">«{e.say}»</span>
            <span className="text-right text-[11px] text-white/45">{e.does}</span>
          </motion.li>
        ))}
      </ul>
      <p className="text-center text-xs text-white/45">Puedes crear los tuyos en Ajustes → Atajos.</p>
      <button type="button" className="jv-btn-primary" onClick={onDone}>
        Vamos allá, hermano
      </button>
    </div>
  );
}
