import type { HomeAdapter } from "./types";

/**
 * Adaptadores sin API pública de control para terceros desde web (Alexa, Google Home)
 * o que requieren credenciales de nube del fabricante (Tuya). Mantienen la misma
 * interfaz: sin credenciales operan en modo simulado sobre el estado sincronizado.
 */
function simulated(id: string, name: string): HomeAdapter {
  return {
    meta: { id, name },
    isReal: () => false,
    async listDevices() {
      return [];
    },
    async setState() {
      return { ok: true };
    },
  };
}

export const alexaAdapter = simulated("alexa", "Alexa");
export const googleHomeAdapter = simulated("google_home", "Google Home");
export const tuyaAdapter = simulated("tuya", "Tuya / Smart Life");
