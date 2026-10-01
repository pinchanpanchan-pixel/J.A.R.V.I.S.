"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { motion } from "framer-motion";
import { BookHeart, BrainCircuit, House, Layers, NotebookPen, Settings2 } from "lucide-react";
import { openQuickNote } from "@/components/QuickNote";

export const NAV_ITEMS = [
  { href: "/", label: "Cerebro", icon: BrainCircuit },
  { href: "/memories", label: "Memorias", icon: Layers },
  { href: "/diary", label: "Diario", icon: BookHeart },
  { href: "/home", label: "Hogar", icon: House },
  { href: "/settings", label: "Ajustes", icon: Settings2 },
] as const;

/** Cristal oscuro translúcido («liquid glass») compartido por la barra y los controles segmentados. */
export const GLASS =
  "border border-white/[0.10] bg-navy-950/55 shadow-[0_14px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl backdrop-saturate-150";

/**
 * Barra de abajo al estilo StepsApp: cápsula flotante de cristal que no toca los bordes.
 * La pestaña activa lleva una píldora más clara y el icono en color de acento; las demás,
 * iconos grises sin texto. La Nota rápida va aparte, en un círculo de acento a la derecha.
 */
export function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  // En iPhone, si el teclado está abierto, el primer toque cierra el teclado, la barra salta
  // y el «click» se pierde. Navegamos ya en el pointerdown táctil (antes del salto) y el click
  // posterior se ignora para no navegar dos veces.
  const touched = useRef<string | null>(null);
  const onPointerDown = (href: string) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || e.button !== 0) return;
    touched.current = href;
    router.push(href);
  };
  const onClick = (href: string) => (e: React.MouseEvent) => {
    if (touched.current === href) e.preventDefault();
    touched.current = null;
  };
  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 px-4"
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <ul data-testid="nav-capsule" className={`pointer-events-auto flex h-[62px] flex-1 items-center justify-between rounded-full px-1.5 ${GLASS}`}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href} className="flex flex-1 justify-center">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  data-tip={label}
                  onPointerDown={onPointerDown(href)}
                  onClick={onClick(href)}
                  className={`relative flex h-[50px] w-full max-w-[64px] touch-manipulation select-none items-center justify-center rounded-full transition-colors ${
                    active ? "text-arc" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      data-testid="nav-pill"
                      transition={{ type: "spring", stiffness: 520, damping: 38 }}
                      className="absolute inset-0 rounded-full bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    />
                  )}
                  <Icon className="relative h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.7} />
                  <span className="sr-only">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => openQuickNote()}
          aria-label="Nota rápida"
          data-testid="nav-quick-note"
          className="pointer-events-auto flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-arc text-navy-900 shadow-[0_12px_32px_rgb(var(--accent)/0.35)]"
        >
          <NotebookPen className="h-6 w-6" />
        </button>
      </div>
    </nav>
  );
}
