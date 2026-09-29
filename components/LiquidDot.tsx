"use client";
import { useEffect, useRef } from "react";

export type DotMode = "idle" | "listening" | "thinking" | "speaking" | "alert" | "offline";

interface Props {
  mode: DotMode;
  /** Nivel de audio 0..1 (micrófono al escuchar, TTS al hablar). Función para no re-renderizar a 60 fps. */
  getLevel?: () => number;
  size?: number;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

const PALETTE: Record<DotMode, { core: string; mid: string; edge: string; glow: string }> = {
  idle: { core: "#C9FFF1", mid: "#64FFDA", edge: "#137a72", glow: "rgba(100,255,218,0.45)" },
  listening: { core: "#E0FBFF", mid: "#38BDF8", edge: "#0b5d8c", glow: "rgba(56,189,248,0.6)" },
  thinking: { core: "#EFE7FF", mid: "#A78BFA", edge: "#4c2f99", glow: "rgba(167,139,250,0.55)" },
  speaking: { core: "#D8FFF6", mid: "#5EEAD4", edge: "#0f766e", glow: "rgba(94,234,212,0.65)" },
  alert: { core: "#FFE3E0", mid: "#FF3B30", edge: "#7f1109", glow: "rgba(255,59,48,0.7)" },
  offline: { core: "#FFF4D6", mid: "#F5C451", edge: "#7a5a12", glow: "rgba(245,196,81,0.45)" },
};

/**
 * Punto líquido de J.A.R.V.I.S. (canvas).
 *  idle      → respira: escala 1 → 1.05 cada 3 s
 *  listening → se deforma como mercurio según la amplitud del micrófono
 *  speaking  → late con la voz (nivel del TTS)
 *  thinking  → ondula despacio
 */
export function LiquidDot({ mode, getLevel, size = 220, className, onClick, ariaLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const levelFn = useRef(getLevel);
  modeRef.current = mode;
  levelFn.current = getLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const box = size * 1.6; // margen para el halo
    canvas.width = box * dpr;
    canvas.height = box * dpr;
    ctx.scale(dpr, dpr);

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const N = 96;
    const start = performance.now();
    let raf = 0;
    let smoothLevel = 0;
    let deform = 0;
    const colors = { ...PALETTE[modeRef.current] };

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const m = modeRef.current;
      const target = PALETTE[m];
      Object.assign(colors, target);

      const raw = Math.max(0, Math.min(1, levelFn.current?.() ?? 0));
      smoothLevel += (raw - smoothLevel) * (raw > smoothLevel ? 0.35 : 0.08);

      // Escala base
      let scale = 1;
      if (m === "idle" || m === "offline") scale = 1 + 0.025 * (1 - Math.cos((2 * Math.PI * t) / 3)); // 1 → 1.05 cada 3 s
      if (m === "speaking") scale = 1 + smoothLevel * 0.12 + 0.01 * Math.sin(t * 9);
      if (m === "listening") scale = 1 + smoothLevel * 0.08;
      if (m === "thinking") scale = 1 + 0.02 * Math.sin(t * 2.2);
      if (m === "alert") scale = 1 + 0.06 * Math.abs(Math.sin(t * 5));
      if (reduceMotion) scale = 1;

      // Deformación tipo mercurio
      const targetDeform =
        m === "listening" ? 0.04 + smoothLevel * 0.22 : m === "speaking" ? 0.03 + smoothLevel * 0.1 : m === "thinking" ? 0.05 : 0.012;
      deform += (targetDeform - deform) * 0.12;

      const cx = box / 2;
      const cy = box / 2;
      const r = (size / 2) * 0.82 * scale;
      ctx.clearRect(0, 0, box, box);

      // Halo
      const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.55);
      halo.addColorStop(0, colors.glow);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, box, box);

      // Contorno deformado (suma de senos = ruido suave)
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const n =
          Math.sin(a * 3 + t * 1.7) * 0.5 +
          Math.sin(a * 5 - t * 2.3 + 1.3) * 0.3 +
          Math.sin(a * 2 + t * 0.9 + 2.1) * 0.35 +
          Math.sin(a * 7 + t * 3.1) * 0.15 * (m === "listening" ? 1 + smoothLevel * 2 : 1);
        const rr = r * (1 + deform * n);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.05);
      body.addColorStop(0, colors.core);
      body.addColorStop(0.45, colors.mid);
      body.addColorStop(1, colors.edge);
      ctx.fillStyle = body;
      ctx.fill();

      // Reflejo especular (efecto líquido)
      ctx.save();
      ctx.clip();
      const spec = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r * 0.55);
      spec.addColorStop(0, "rgba(255,255,255,0.55)");
      spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec;
      ctx.fillRect(0, 0, box, box);
      // Brillo inferior
      const rim = ctx.createRadialGradient(cx + r * 0.3, cy + r * 0.55, 0, cx + r * 0.3, cy + r * 0.55, r * 0.6);
      rim.addColorStop(0, "rgba(255,255,255,0.12)");
      rim.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rim;
      ctx.fillRect(0, 0, box, box);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const box = size * 1.6;
  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      role={onClick ? "button" : "img"}
      aria-label={ariaLabel ?? `J.A.R.V.I.S. ${mode}`}
      data-mode={mode}
      className={className}
      style={{ width: box, height: box, margin: -(box - size) / 2, cursor: onClick ? "pointer" : undefined }}
    />
  );
}
