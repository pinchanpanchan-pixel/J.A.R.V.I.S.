"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { motion } from "framer-motion";
import { BookHeart, BrainCircuit, House, Layers, Settings2 } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Cerebro", icon: BrainCircuit },
  { href: "/memories", label: "Memorias", icon: Layers },
  { href: "/diary", label: "Diario", icon: BookHeart },
  { href: "/home", label: "Hogar", icon: House },
  { href: "/settings", label: "Ajustes", icon: Settings2 },
] as const;

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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-navy-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onPointerDown={onPointerDown(href)}
                onClick={onClick(href)}
                className={`relative touch-manipulation select-none flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition ${active ? "text-arc" : "text-white/45 hover:text-white/75"}`}
              >
                {active && <motion.span layoutId="nav-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-arc" />}
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.7} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
