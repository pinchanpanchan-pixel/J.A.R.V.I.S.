"use client";
import { mic, type MicFrame } from "./mic";
import { Vad, type VadOptions } from "./vad";
import { concatFloat32, downsample, encodeWav } from "./wav";

export interface CapturedPhrase {
  wav: Blob;
  durationMs: number;
}

/**
 * Captura una frase del micrófono compartido.
 *  - mode "manual": graba hasta que se llama a finish() (mantener pulsado).
 *  - mode "vad":    termina sola tras 800 ms de silencio (escucha continua).
 * Incluye 300 ms de pre-roll para no cortar la primera sílaba.
 */
export class PhraseCapture {
  private chunks: Float32Array[] = [];
  private preroll: Float32Array[] = [];
  private unsub: (() => void) | null = null;
  private vad: Vad | null = null;
  private heardVoice = false;
  private startedAt = 0;
  private resolve!: (p: CapturedPhrase | null) => void;
  readonly done: Promise<CapturedPhrase | null>;

  constructor(
    private readonly mode: "manual" | "vad",
    private readonly opts: { vad?: Partial<VadOptions>; noSpeechTimeoutMs?: number; onVoiceStart?: () => void } = {},
  ) {
    this.done = new Promise((r) => (this.resolve = r));
  }

  async start(prerollFrames: Float32Array[] = []) {
    await mic.start();
    this.preroll = prerollFrames;
    this.startedAt = performance.now();
    if (this.mode === "vad") this.vad = new Vad({ ...this.opts.vad });
    this.unsub = mic.onFrame((f) => this.onFrame(f));
  }

  private onFrame(f: MicFrame) {
    this.chunks.push(f.samples);
    if (!this.vad) return;
    const ev = this.vad.feed(f.rms, f.t);
    if (ev === "start") {
      this.heardVoice = true;
      this.opts.onVoiceStart?.();
    }
    if (ev === "end") void this.finish();
    else if (!this.heardVoice && f.t - this.startedAt > (this.opts.noSpeechTimeoutMs ?? 7000)) this.cancel();
  }

  /** Termina y devuelve el WAV (16 kHz mono). */
  finish(): Promise<CapturedPhrase | null> {
    if (!this.unsub) return this.done;
    this.unsub();
    this.unsub = null;
    const all = concatFloat32([...this.preroll, ...this.chunks]);
    const durationMs = (all.length / mic.sampleRate) * 1000;
    if (durationMs < 250 || (this.mode === "vad" && !this.heardVoice)) {
      this.resolve(null);
      return this.done;
    }
    const pcm = downsample(all, mic.sampleRate, 16000);
    this.resolve({ wav: new Blob([encodeWav(pcm, 16000)], { type: "audio/wav" }), durationMs });
    return this.done;
  }

  cancel() {
    this.unsub?.();
    this.unsub = null;
    this.resolve(null);
  }
}
