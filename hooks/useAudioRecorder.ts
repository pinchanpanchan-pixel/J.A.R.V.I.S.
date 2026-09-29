"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Grabadora con MediaRecorder (elige el formato soportado: Safari usa mp4/aac). */
export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.start(250);
      recorder.current = rec;
      startedAt.current = Date.now();
      setRecording(true);
      // Nivel de audio para la animación
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        raf.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No puedo acceder al micrófono");
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; mimeType: string; durationMs: number } | null>((resolve) => {
        const rec = recorder.current;
        if (!rec || rec.state === "inactive") {
          resolve(null);
          return;
        }
        rec.onstop = () => {
          const mimeType = rec.mimeType || "audio/webm";
          const blob = new Blob(chunks.current, { type: mimeType });
          resolve({ blob, mimeType, durationMs: Date.now() - startedAt.current });
          recorder.current = null;
          setRecording(false);
          cleanup();
        };
        rec.stop();
      }),
    [cleanup],
  );

  return { recording, error, level, start, stop };
}
