/**
 * Sensibilidad de las palmadas (0..1, la que ve el usuario) <-> umbral de pico del detector.
 * 0 % = solo palmadas muy fuertes (umbral 0,9); 100 % = palmadas flojas (umbral 0,05).
 */
export const CLAP_MIN_THRESHOLD = 0.05;
export const CLAP_MAX_THRESHOLD = 0.9;

export function clapThreshold(sensitivity: number): number {
  const s = Math.max(0, Math.min(1, sensitivity));
  return Math.round((CLAP_MAX_THRESHOLD - (CLAP_MAX_THRESHOLD - CLAP_MIN_THRESHOLD) * s) * 1000) / 1000;
}

export function clapSensitivity(threshold: number): number {
  const t = Math.max(CLAP_MIN_THRESHOLD, Math.min(CLAP_MAX_THRESHOLD, threshold));
  return (CLAP_MAX_THRESHOLD - t) / (CLAP_MAX_THRESHOLD - CLAP_MIN_THRESHOLD);
}
