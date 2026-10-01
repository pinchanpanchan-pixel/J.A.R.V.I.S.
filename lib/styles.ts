import type { UiStyle } from "@/types/db";

/**
 * Estilos de J.A.R.V.I.S.: fondo, bolita, logo, paleta y animaciones.
 * Las variables de color están en app/globals.css (html[data-style=…]).
 */
export interface StyleDef {
  id: UiStyle;
  name: string;
  description: string;
  paid: boolean;
  /** Colores para la vista previa y la barra del navegador (theme-color). */
  preview: { bg: string; accent: string; dot: string };
}

export const STYLES: StyleDef[] = [
  {
    id: "actual",
    name: "Actual",
    description: "El de siempre: azul marino y la bolita líquida.",
    paid: false,
    preview: { bg: "linear-gradient(180deg,#0A192F,#001122)", accent: "#64FFDA", dot: "radial-gradient(circle at 35% 30%,#C9FFF1,#64FFDA 45%,#137a72)" },
  },
  {
    id: "constelacion",
    name: "Constelación",
    description: "Azul noche y lavanda, saludo en letra serif y una esfera de puntos que se deforma al hablar.",
    paid: true,
    preview: { bg: "radial-gradient(120% 80% at 50% 0%,#2A2768 0%,#0D1033 55%,#070920 100%)", accent: "#C4B5FD", dot: "radial-gradient(circle,#fff 0 1px,transparent 1.5px) 0 0/6px 6px" },
  },
  {
    id: "pulso",
    name: "Pulso de luz",
    description: "Casi negro y un punto de luz violeta y blanca que late con la voz. Mínimo.",
    paid: true,
    preview: { bg: "#050508", accent: "#A78BFA", dot: "radial-gradient(circle,#fff 0%,#C4B5FD 25%,#7C3AED 55%,transparent 72%)" },
  },
];

export const styleById = (id: string | null | undefined): StyleDef => STYLES.find((s) => s.id === id) ?? STYLES[0];

/** ¿Puede usar este estilo? Los de pago: cualquier plan de pago y las cuentas propietarias. */
export function canUseStyle(id: UiStyle, plan: string | null | undefined, isOwner: boolean): boolean {
  const def = styleById(id);
  return !def.paid || isOwner || (!!plan && plan !== "free");
}

export const STYLE_CACHE_KEY = "jarvis.style";
export const THEME_COLOR: Record<UiStyle, string> = { actual: "#0A192F", constelacion: "#0D1033", pulso: "#050508" };
