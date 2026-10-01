"use client";

/** AudioContext compartido. iOS exige desbloquearlo con un gesto del usuario. */
let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctx({ latencyHint: "interactive" });
  }
  return ctx;
}

let unlocked = false;
const unlockWaiters = new Set<() => void>();
/** ¿Ya hubo un gesto que desbloquea el audio? (iOS no deja sonar nada antes). */
export const isAudioUnlocked = () => unlocked;
/** Resuelve cuando el audio esté desbloqueado (al primer toque si aún no lo está). */
export function whenAudioUnlocked(): Promise<void> {
  if (unlocked) return Promise.resolve();
  return new Promise((r) => unlockWaiters.add(r));
}
/** Llamar en el primer toque/clic: reanuda el contexto y reproduce un silencio (desbloqueo iOS). */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  const c = getAudioContext();
  try {
    if (c.state === "suspended") await c.resume();
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
    unlocked = true;
    unlockWaiters.forEach((w) => w());
    unlockWaiters.clear();
  } catch {
    /* se reintentará en el siguiente gesto */
  }
}

export function installAudioUnlock() {
  const handler = () => {
    void unlockAudio();
    if (unlocked) {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    }
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
}
