"use client";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { STYLE_CACHE_KEY, THEME_COLOR, canUseStyle } from "@/lib/styles";
import type { UiStyle } from "@/types/db";

/**
 * Aplica el estilo elegido (html[data-style]) y lo recuerda en este dispositivo para el
 * arranque. Si el plan ya no permite un estilo de pago, vuelve a «Actual».
 */
export function StyleController() {
  const { profile, isOwner } = useProfile();
  const chosen = (profile?.ui_style ?? null) as UiStyle | null;
  const style: UiStyle = chosen && canUseStyle(chosen, profile?.subscription, isOwner) ? chosen : "actual";

  useEffect(() => {
    if (!profile) return;
    const root = document.documentElement;
    if (style === "actual") delete root.dataset.style;
    else root.dataset.style = style;
    try {
      localStorage.setItem(STYLE_CACHE_KEY, style);
    } catch {
      /* sin almacenamiento */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[style]);
  }, [profile, style]);

  return null;
}

/** Estilo efectivo (para los componentes que cambian de forma: bolita, saludo…). */
export function useUiStyle(): UiStyle {
  const { profile, isOwner } = useProfile();
  const chosen = (profile?.ui_style ?? "actual") as UiStyle;
  return canUseStyle(chosen, profile?.subscription, isOwner) ? chosen : "actual";
}
