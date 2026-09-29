"use client";
import { Clock } from "lucide-react";

export const DIARY_PRESETS = [
  { label: "Desayuno", time: "08:30" },
  { label: "Mañana", time: "11:00" },
  { label: "Comida", time: "14:30" },
  { label: "Cena", time: "21:00" },
  { label: "Noche", time: "22:30" },
] as const;

/** Botones rápidos + selector de hora personalizada (p.ej. 22:30). */
export function DiaryTimePicker({
  time,
  label,
  onChange,
}: {
  time: string | null;
  label: string | null;
  onChange: (time: string, label: string) => void;
}) {
  const isPreset = DIARY_PRESETS.some((p) => p.label === label && p.time === time);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {DIARY_PRESETS.map((p) => {
          const active = isPreset && p.label === label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.time, p.label)}
              className={`rounded-2xl border px-2 py-3 text-sm transition ${
                active ? "border-arc bg-arc/15 text-white" : "border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
              }`}
            >
              <div className="font-semibold">{p.label}</div>
              <div className="text-[11px] text-white/45">{p.time}</div>
            </button>
          );
        })}
        <label
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border px-2 py-3 text-sm transition ${
            !isPreset && time ? "border-arc bg-arc/15" : "border-white/10 bg-white/[0.04]"
          }`}
        >
          <span className="flex items-center gap-1 font-semibold">
            <Clock className="h-3.5 w-3.5" /> Otra
          </span>
          <input
            type="time"
            aria-label="Hora personalizada"
            value={!isPreset && time ? time : ""}
            onChange={(e) => e.target.value && onChange(e.target.value, "Personalizada")}
            className="mt-0.5 w-full bg-transparent text-center text-[12px] text-white/70 outline-none [color-scheme:dark]"
          />
        </label>
      </div>
      {time && (
        <p className="text-center text-sm text-white/60">
          Te preguntaré cada día a las <span className="font-semibold text-arc">{time}</span>.
        </p>
      )}
    </div>
  );
}
