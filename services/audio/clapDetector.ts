/**
 * Detector de DOBLE PALMADA (lógica pura, testeable).
 * Se alimenta con tramas del AnalyserNode (pico y RMS de cada trama).
 * Una palmada = transitorio: pico alto que supera el umbral Y es muy superior al ruido
 * de fondo (que se adapta), y decae rápido. Dos palmadas = dos transitorios separados
 * entre 120 ms y 800 ms.
 */
export interface ClapOptions {
  /** Umbral de pico (0..1). Configurable en voice_prefs.clap_threshold. */
  threshold: number;
  /** Ventana máxima entre las dos palmadas (ms). Especificación: 800 ms. */
  windowMs: number;
  /** Separación mínima entre palmadas (evita contar el eco de la misma palmada). */
  minGapMs: number;
  /** El pico debe ser N veces el ruido de fondo. */
  noiseRatio: number;
  /** Tras detectar, ignora durante este tiempo (ms). */
  cooldownMs: number;
}

export const DEFAULT_CLAP: ClapOptions = { threshold: 0.35, windowMs: 800, minGapMs: 120, noiseRatio: 4, cooldownMs: 1500 };

export class ClapDetector {
  private noise = 0.01;
  private lastClap = -Infinity;
  private lastPeakAt = -Infinity;
  private cooldownUntil = -Infinity;
  private prevPeak = 0;
  readonly opts: ClapOptions;

  constructor(opts: Partial<ClapOptions> = {}) {
    this.opts = { ...DEFAULT_CLAP, ...opts };
  }

  /** Devuelve true cuando detecta la segunda palmada. `peak` y `rms` en 0..1, `t` en ms. */
  feed(peak: number, rms: number, t: number): boolean {
    const { threshold, windowMs, minGapMs, noiseRatio, cooldownMs } = this.opts;
    const onset = peak > threshold && peak > this.noise * noiseRatio && peak > this.prevPeak * 1.8;
    this.prevPeak = peak;
    // Ruido de fondo: sigue lento al RMS cuando no hay transitorio
    if (!onset) this.noise = this.noise * 0.97 + rms * 0.03;
    if (t < this.cooldownUntil || !onset) return false;
    if (t - this.lastPeakAt < minGapMs) return false; // misma palmada (cola/eco)
    this.lastPeakAt = t;
    if (t - this.lastClap <= windowMs) {
      this.lastClap = -Infinity;
      this.cooldownUntil = t + cooldownMs;
      return true;
    }
    this.lastClap = t;
    return false;
  }

  reset() {
    this.lastClap = -Infinity;
    this.lastPeakAt = -Infinity;
    this.prevPeak = 0;
  }
}
