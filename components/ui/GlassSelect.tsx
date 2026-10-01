"use client";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface GlassOption<T extends string | number = string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Desplegable «liquid glass» (sustituye a los <select> nativos): botón de cristal y lista
 * flotante encima de todo (portal), que se abre hacia arriba si abajo no cabe. Teclado:
 * flechas, Intro y Escape. Accesible como combobox/listbox.
 */
export function GlassSelect<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Elige…",
  disabled = false,
  className = "",
  size = "md",
}: {
  value: T | null | undefined;
  onChange: (v: T) => void;
  options: Array<GlassOption<T>>;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const want = Math.min(320, options.length * 46 + 12);
    const width = Math.max(r.width, 200);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    if (below >= Math.min(want, 220) || below >= above) setPos({ left, top: r.bottom + 6, width, maxH: Math.max(140, Math.min(want, below)) });
    else setPos({ left, bottom: window.innerHeight - r.top + 6, width, maxH: Math.max(140, Math.min(want, above)) });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, place, options, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (btn.current?.contains(t) || list.current?.contains(t)) return;
      setOpen(false);
    };
    const reposition = () => place();
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (o: GlassOption<T>) => {
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };

  // Escribir letras salta a la opción que empieza así (útil en listas largas como países).
  const typed = useRef({ text: "", at: 0 });
  const typeAhead = (key: string) => {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 700 ? "" : typed.current.text) + key.toLowerCase(), at: now };
    const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const i = options.findIndex((o) => norm(o.label).startsWith(norm(typed.current.text)));
    if (i >= 0) setActive(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (open && e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey) {
      typeAhead(e.key);
      return;
    }
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[active];
      if (o) choose(o);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.06] text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition hover:bg-white/[0.09] disabled:opacity-50 ${
          size === "sm" ? "px-3.5 py-2 text-sm" : "px-4 py-3.5 text-base"
        } ${open ? "border-arc/50 bg-white/[0.09]" : ""} ${className}`}
      >
        <span className={`truncate ${current ? "" : "text-white/40"}`}>{current?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.ul
                ref={list}
                id={`${id}-list`}
                role="listbox"
                aria-label={ariaLabel}
                initial={{ opacity: 0, scale: 0.97, y: pos.top !== undefined ? -4 : 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH }}
                className="z-[120] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.14] bg-[#0F2440]/80 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-2xl"
              >
                {options.map((o, i) => {
                  const selected = o.value === value;
                  return (
                    <li
                      key={String(o.value)}
                      role="option"
                      aria-selected={selected}
                      data-index={i}
                      onPointerEnter={() => setActive(i)}
                      onClick={() => choose(o)}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[15px] ${i === active ? "bg-white/[0.10]" : ""} ${
                        selected ? "text-arc" : "text-white/90"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{o.label}</span>
                        {o.hint && <span className="block truncate text-[11.5px] text-white/45">{o.hint}</span>}
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0" />}
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
