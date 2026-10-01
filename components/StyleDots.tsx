"use client";
import { useEffect, useRef } from "react";
import { LiquidDot, type DotMode } from "@/components/LiquidDot";
import { useUiStyle } from "@/components/providers/StyleController";
import type { UiStyle } from "@/types/db";

interface DotProps {
  mode: DotMode;
  getLevel?: () => number;
  size?: number;
  className?: string;
}

/** Bucle de animación común: canvas con DPR, nivel suavizado y respeto a «reducir movimiento». */
function useCanvasLoop(
  size: number,
  mode: DotMode,
  getLevel: (() => number) | undefined,
  draw: (c: CanvasRenderingContext2D, s: { t: number; box: number; level: number; mode: DotMode; reduce: boolean }) => void,
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const levelRef = useRef(getLevel);
  const drawRef = useRef(draw);
  modeRef.current = mode;
  levelRef.current = getLevel;
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const box = size * 1.6;
    canvas.width = box * dpr;
    canvas.height = box * dpr;
    ctx.scale(dpr, dpr);
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let smooth = 0;
    let raf = 0;
    const loop = (now: number) => {
      const raw = Math.max(0, Math.min(1, levelRef.current?.() ?? 0));
      smooth += (raw - smooth) * (raw > smooth ? 0.3 : 0.07);
      ctx.clearRect(0, 0, box, box);
      drawRef.current(ctx, { t: (now - start) / 1000, box, level: smooth, mode: modeRef.current, reduce });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size]);
  return ref;
}

/**
 * Constelación: esfera de puntitos blancos que gira despacio. Al hablar (o escucharte) se
 * deforma siguiendo la voz y, al callar, los puntos vuelven a formar el círculo.
 */
const N = 420;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SPHERE = Array.from({ length: N }, (_, i) => {
  const y = 1 - (i / (N - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const th = GOLDEN * i;
  return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, seed: (i * 9301 + 49297) % 233280 / 233280 };
});

export function ConstellationDot({ mode, getLevel, size = 200, className }: DotProps) {
  const deform = useRef(0);
  const ref = useCanvasLoop(size, mode, getLevel, (c, { t, box, level, mode: m, reduce }) => {
    const target = m === "listening" ? 0.08 + level * 0.55 : m === "speaking" ? 0.05 + level * 0.4 : m === "thinking" ? 0.12 : 0;
    deform.current += (target - deform.current) * (target > deform.current ? 0.2 : 0.05); // vuelve al círculo despacio
    const rot = reduce ? 0 : t * (m === "thinking" ? 0.6 : 0.18);
    const cx = box / 2;
    const cy = box / 2;
    const R = (size / 2) * 0.86 * (m === "idle" && !reduce ? 1 + 0.015 * Math.sin(t * 2.1) : 1);
    // halo lavanda muy suave
    const halo = c.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5);
    halo.addColorStop(0, "rgba(196,181,253,0.10)");
    halo.addColorStop(1, "rgba(196,181,253,0)");
    c.fillStyle = halo;
    c.fillRect(0, 0, box, box);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (const p of SPHERE) {
      const x = p.x * cos - p.z * sin;
      const z = p.x * sin + p.z * cos;
      const wave = Math.sin(p.y * 5 + t * 3.2 + p.seed * 6) * 0.6 + Math.sin(x * 4 - t * 2.4) * 0.4;
      const k = 1 + deform.current * wave;
      const depth = (z + 1) / 2; // 0 detrás, 1 delante
      const px = cx + x * R * k;
      const py = cy + p.y * R * k;
      c.globalAlpha = 0.18 + depth * 0.82;
      c.fillStyle = depth > 0.75 ? "#FFFFFF" : "#DDD6FE";
      c.beginPath();
      c.arc(px, py, 0.6 + depth * 1.25, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  });
  const box = size * 1.6;
  return <canvas ref={ref} data-mode={mode} aria-label={`Constelación: ${mode}`} role="img" className={className} style={{ width: box, height: box, margin: -(box - size) / 2 }} />;
}

/** Pulso de luz: un punto de luz violeta y blanca que se expande y se contrae con la voz. */
export function PulseDot({ mode, getLevel, size = 200, className }: DotProps) {
  const ref = useCanvasLoop(size, mode, getLevel, (c, { t, box, level, mode: m, reduce }) => {
    const cx = box / 2;
    const cy = box / 2;
    const base = (size / 2) * 0.42;
    const breathe = reduce ? 0 : m === "idle" ? 0.06 * Math.sin(t * 1.6) : m === "thinking" ? 0.1 * Math.sin(t * 4) : 0;
    const r = base * (1 + breathe + level * (m === "speaking" ? 1.1 : 0.8));
    // resplandor exterior
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
    glow.addColorStop(0, "rgba(167,139,250,0.45)");
    glow.addColorStop(0.35, "rgba(124,58,237,0.18)");
    glow.addColorStop(1, "rgba(124,58,237,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, box, box);
    // núcleo de luz
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    core.addColorStop(0, "rgba(255,255,255,1)");
    core.addColorStop(0.35, "rgba(237,233,254,0.95)");
    core.addColorStop(0.7, "rgba(167,139,250,0.75)");
    core.addColorStop(1, "rgba(124,58,237,0)");
    c.fillStyle = core;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
  });
  const box = size * 1.6;
  return <canvas ref={ref} data-mode={mode} aria-label={`Pulso de luz: ${mode}`} role="img" className={className} style={{ width: box, height: box, margin: -(box - size) / 2 }} />;
}

/** La bolita del estilo elegido (Actual: la líquida de siempre). */
export function StyledDot(props: DotProps & { style?: UiStyle }) {
  const current = useUiStyle();
  const style = props.style ?? current;
  if (style === "constelacion") return <ConstellationDot {...props} />;
  if (style === "pulso") return <PulseDot {...props} />;
  return <LiquidDot {...props} />;
}
