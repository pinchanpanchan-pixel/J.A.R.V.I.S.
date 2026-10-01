"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

const SELECTOR = "button, a, [role='button']";
const HOVER_DELAY = 400;
const LONG_PRESS = 480;

/** Texto de la etiqueta: data-tip, title (se convierte a data-tip) o aria-label si el botón es solo icono. */
function tipFor(el: HTMLElement): string | null {
  if (el.closest("[data-notip]")) return null;
  const title = el.getAttribute("title");
  if (title) {
    // Sin title nativo: si no, saldrían dos etiquetas a la vez.
    el.dataset.tip = el.dataset.tip ?? title;
    el.removeAttribute("title");
  }
  if (el.dataset.tip) return el.dataset.tip;
  const label = el.getAttribute("aria-label");
  if (label && !(el.textContent ?? "").trim()) return label;
  return null;
}

interface Tip {
  text: string;
  x: number;
  y: number;
  below: boolean;
}

/**
 * Etiquetas para los botones que solo son un icono: aparecen al pasar el ratón (ordenador) o al
 * mantener pulsado (móvil). Tras una pulsación larga no se dispara el botón.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const suppressClick = useRef<HTMLElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const hide = () => {
      clear();
      current.current = null;
      setTip(null);
    };
    const show = (el: HTMLElement, text: string) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const below = r.top < 48;
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const target = (e: Event) => (e.target instanceof Element ? (e.target.closest(SELECTOR) as HTMLElement | null) : null);

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = target(e);
      if (el === current.current) return;
      hide();
      if (!el) return;
      const text = tipFor(el);
      if (!text) return;
      current.current = el;
      timer.current = setTimeout(() => show(el, text), HOVER_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !current.current) return;
      const to = e.relatedTarget instanceof Node ? e.relatedTarget : null;
      if (!to || !current.current.contains(to)) hide();
    };
    const onDown = (e: PointerEvent) => {
      hide();
      if (e.pointerType === "mouse") return;
      const el = target(e);
      const text = el && tipFor(el);
      if (!el || !text) return;
      current.current = el;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        suppressClick.current = el;
        show(el, text);
      }, LONG_PRESS);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !start.current || !timer.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      clear();
      start.current = null;
      if (suppressClick.current) setTimeout(hide, 1200);
    };
    const onClick = (e: MouseEvent) => {
      const s = suppressClick.current;
      if (s && e.target instanceof Node && s.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
      suppressClick.current = null;
    };
    const onContext = (e: Event) => {
      if (suppressClick.current || timer.current) e.preventDefault();
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("contextmenu", onContext, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", hide, true);
    return () => {
      clear();
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("contextmenu", onContext, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", hide, true);
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {tip && (
        <motion.div
          key={`${tip.text}-${tip.x}-${tip.y}`}
          role="tooltip"
          data-testid="tooltip"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.12 }}
          style={{
            position: "fixed",
            left: Math.min(Math.max(tip.x, 90), window.innerWidth - 90),
            top: tip.y,
            translateX: "-50%",
            translateY: tip.below ? "0%" : "-100%",
          }}
          className="pointer-events-none z-[130] max-w-[170px] rounded-xl border border-white/[0.12] bg-navy-950/85 px-2.5 py-1.5 text-center text-[12px] leading-snug text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          {tip.text}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
