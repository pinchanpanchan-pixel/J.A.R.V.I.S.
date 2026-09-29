/**
 * Detección de actividad de voz (VAD) por energía con umbral adaptativo e histéresis.
 * Lógica pura: se alimenta con el RMS de cada trama.
 */
export interface VadOptions {
  /** Multiplicador sobre el ruido de fondo para considerar voz. */
  ratio: number;
  /** RMS mínimo absoluto para considerar voz. */
  minRms: number;
  /** Voz continua necesaria para disparar el inicio (ms). */
  startMs: number;
  /** Silencio necesario para dar por terminada la frase (ms). */
  hangoverMs: number;
  /** Duración máxima de una frase (ms). */
  maxMs: number;
}

export const DEFAULT_VAD: VadOptions = { ratio: 3, minRms: 0.012, startMs: 120, hangoverMs: 800, maxMs: 30000 };

export type VadEvent = "start" | "end" | null;

export class Vad {
  private noise = 0.005;
  private speaking = false;
  private voiceSince = -1;
  private silenceSince = -1;
  private startedAt = 0;
  readonly opts: VadOptions;

  constructor(opts: Partial<VadOptions> = {}) {
    this.opts = { ...DEFAULT_VAD, ...opts };
  }

  get isSpeaking() {
    return this.speaking;
  }

  feed(rms: number, t: number): VadEvent {
    const { ratio, minRms, startMs, hangoverMs, maxMs } = this.opts;
    const voiced = rms > Math.max(minRms, this.noise * ratio);
    if (!voiced && !this.speaking) this.noise = this.noise * 0.95 + rms * 0.05;

    if (!this.speaking) {
      if (voiced) {
        if (this.voiceSince < 0) this.voiceSince = t;
        if (t - this.voiceSince >= startMs) {
          this.speaking = true;
          this.startedAt = this.voiceSince;
          this.silenceSince = -1;
          return "start";
        }
      } else this.voiceSince = -1;
      return null;
    }

    if (voiced) this.silenceSince = -1;
    else if (this.silenceSince < 0) this.silenceSince = t;
    if ((this.silenceSince >= 0 && t - this.silenceSince >= hangoverMs) || t - this.startedAt >= maxMs) {
      this.speaking = false;
      this.voiceSince = -1;
      return "end";
    }
    return null;
  }

  reset() {
    this.speaking = false;
    this.voiceSince = -1;
    this.silenceSince = -1;
  }
}
