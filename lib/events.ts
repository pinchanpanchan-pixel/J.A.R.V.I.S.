/** Eventos globales de la app (desacoplan UI, voz y skills). */
export const JARVIS_EVENTS = {
  /** Empezar a escuchar (botón flotante, notificación, atajo). */
  talk: "jarvis:talk",
  /** Alerta de WorldMonitor a pantalla completa. */
  worldAlert: "jarvis:world-alert",
  /** Simulacro de alerta: solo se muestra en este dispositivo, NUNCA se guarda como alerta real. */
  drill: "jarvis:drill",
} as const;

export function emit(name: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
