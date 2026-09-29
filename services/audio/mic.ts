"use client";
import { getAudioContext } from "./context";

export interface MicFrame {
  samples: Float32Array; // copia de la trama (mono, a la frecuencia del contexto)
  peak: number;
  rms: number;
  t: number; // ms (performance.now)
}

type FrameListener = (f: MicFrame) => void;

/**
 * Micrófono compartido: UNA sola captura para VAD, palmadas, nivel del punto líquido y
 * grabación PCM (Whisper). Evita abrir varios getUserMedia a la vez (problemático en iOS).
 */
class MicInput {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private listeners = new Set<FrameListener>();
  private starting: Promise<void> | null = null;
  level = 0;
  sampleRate = 48000;

  get active() {
    return !!this.stream;
  }

  async start(): Promise<void> {
    if (this.stream) return;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
      });
      this.stream = stream;
      this.sampleRate = ctx.sampleRate;
      this.source = ctx.createMediaStreamSource(stream);
      // ScriptProcessor: compatible con todos los navegadores (incl. Safari iOS).
      this.processor = ctx.createScriptProcessor(1024, 1, 1);
      this.sink = ctx.createGain();
      this.sink.gain.value = 0; // no se oye el micro
      this.processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        let peak = 0;
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i]);
          if (v > peak) peak = v;
          sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        this.level = Math.min(1, rms * 6);
        const frame: MicFrame = { samples: new Float32Array(data), peak, rms, t: performance.now() };
        this.listeners.forEach((l) => l(frame));
      };
      this.source.connect(this.processor);
      this.processor.connect(this.sink);
      this.sink.connect(ctx.destination);
      stream.getAudioTracks()[0]?.addEventListener("ended", () => this.stop());
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  stop() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.processor = null;
    this.source = null;
    this.sink = null;
    this.level = 0;
  }

  onFrame(fn: FrameListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const mic = typeof window !== "undefined" ? new MicInput() : (null as unknown as MicInput);

export async function micPermission(): Promise<PermissionState | "unknown"> {
  try {
    const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return p.state;
  } catch {
    return "unknown";
  }
}
