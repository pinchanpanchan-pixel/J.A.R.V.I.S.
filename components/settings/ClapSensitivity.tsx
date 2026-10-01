"use client";
import { useEffect, useRef, useState } from "react";
import { clapSensitivity, clapThreshold } from "@/lib/audio/clap";

/**
 * Barra de sensibilidad fluida (0–100 %, cualquier valor). Se mueve con estado local y
 * guarda al soltar (o tras una pausa), así no salta mientras arrastras.
 */
export function ClapSensitivity({ threshold, onCommit }: { threshold: number; onCommit: (threshold: number) => void }) {
  const [value, setValue] = useState(() => clapSensitivity(threshold));
  const dragging = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dragging.current) setValue(clapSensitivity(threshold));
  }, [threshold]);
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const commit = (v: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(clapThreshold(v)), 250);
  };
  const pct = Math.round(value * 100);

  return (
    <div className="pt-3">
      <div className="mb-2 flex justify-between text-xs text-white/50">
        <span>Sensibilidad de las palmadas</span>
        <span className="tabular-nums text-white/80">{pct} %</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step="any"
        value={value}
        onPointerDown={() => (dragging.current = true)}
        onPointerUp={() => (dragging.current = false)}
        onChange={(e) => {
          const v = Number(e.target.value);
          setValue(v);
          commit(v);
        }}
        className="jv-range w-full"
        style={{ ["--pct" as string]: `${pct}%` }}
        aria-label="Sensibilidad de las palmadas"
        aria-valuetext={`${pct} %`}
      />
      <div className="mt-1 flex justify-between text-[11px] text-white/30">
        <span>Solo fuertes</span>
        <span>Muy sensible</span>
      </div>
    </div>
  );
}
