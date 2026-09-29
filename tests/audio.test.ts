import { describe, it, expect } from "vitest";
import { ClapDetector } from "@/services/audio/clapDetector";
import { matchWake, wakeName } from "@/services/audio/wakeWord";
import { Vad } from "@/services/audio/vad";
import { encodeWav, downsample } from "@/services/audio/wav";
import { splitSentences } from "@/services/audio/sentences";

/** Genera tramas cada 20 ms: ruido bajo + palmadas en los instantes indicados. */
function frames(durationMs: number, claps: number[], noise = 0.02) {
  const out: Array<[number, number, number]> = [];
  for (let t = 0; t < durationMs; t += 20) {
    const clap = claps.find((c) => t >= c && t < c + 40);
    const peak = clap !== undefined ? (t === clap ? 0.9 : 0.25) : noise * (1 + Math.random() * 0.5);
    out.push([peak, peak * 0.5, t]);
  }
  return out;
}

describe("ClapDetector", () => {
  it("detecta dos palmadas en menos de 800 ms", () => {
    const d = new ClapDetector();
    const hits = frames(3000, [1000, 1400]).filter(([p, r, t]) => d.feed(p, r, t));
    expect(hits).toHaveLength(1);
  });
  it("ignora una palmada sola", () => {
    const d = new ClapDetector();
    expect(frames(3000, [1000]).some(([p, r, t]) => d.feed(p, r, t))).toBe(false);
  });
  it("ignora dos palmadas separadas más de 800 ms", () => {
    const d = new ClapDetector();
    expect(frames(4000, [1000, 1900]).some(([p, r, t]) => d.feed(p, r, t))).toBe(false);
  });
  it("no se dispara con ruido fuerte constante (música)", () => {
    const d = new ClapDetector();
    const loud = Array.from({ length: 200 }, (_, i) => [0.5 + 0.02 * Math.sin(i), 0.35, i * 20] as const);
    expect(loud.some(([p, r, t]) => d.feed(p, r, t))).toBe(false);
  });
});

describe("palabra de activación", () => {
  it("nombre por defecto y personalizado", () => {
    expect(wakeName("J.A.R.V.I.S.")).toBe("jarvis");
    expect(wakeName("Friday")).toBe("friday");
  });
  it.each([
    ["Hey Jarvis", "J.A.R.V.I.S.", true, ""],
    ["jarvis apaga la luz", "J.A.R.V.I.S.", true, "apaga la luz"],
    ["oye yarvis qué hora es", "J.A.R.V.I.S.", true, "que hora es"],
    ["hey friday", "Friday", true, ""],
    ["Hey Jarvis", "Friday", false, ""],
    ["ayer hablé con jarvis de eso", "J.A.R.V.I.S.", false, ""],
    ["hey fryday pon música", "Friday", true, "pon musica"],
    ["hey max", "Max", true, ""],
    ["hey mix", "Max", false, ""],
  ])("%s (%s) -> %s", (text, name, matched, command) => {
    const m = matchWake(text, name);
    expect(m.matched).toBe(matched);
    if (matched) expect(m.command).toBe(command);
  });
});

describe("VAD", () => {
  it("detecta inicio y fin de frase con histéresis", () => {
    const v = new Vad();
    const events: string[] = [];
    for (let t = 0; t < 4000; t += 20) {
      const speaking = t >= 1000 && t < 2000;
      const e = v.feed(speaking ? 0.1 : 0.004, t);
      if (e) events.push(`${e}@${t}`);
    }
    expect(events.map((e) => e.split("@")[0])).toEqual(["start", "end"]);
    const endAt = Number(events[1].split("@")[1]);
    expect(endAt).toBeGreaterThanOrEqual(2000 + 800 - 20);
  });
  it("una pausa corta no corta la frase", () => {
    const v = new Vad();
    const events: string[] = [];
    for (let t = 0; t < 5000; t += 20) {
      const speaking = (t >= 1000 && t < 1800) || (t >= 2200 && t < 3000); // pausa de 400 ms
      const e = v.feed(speaking ? 0.1 : 0.004, t);
      if (e) events.push(e);
    }
    expect(events).toEqual(["start", "end"]);
  });
});

describe("WAV", () => {
  it("cabecera correcta y remuestreo a 16 kHz", () => {
    const s = downsample(new Float32Array(48000).fill(0.5), 48000, 16000);
    expect(s.length).toBe(16000);
    const buf = encodeWav(s);
    const v = new DataView(buf);
    expect(String.fromCharCode(...new Uint8Array(buf, 0, 4))).toBe("RIFF");
    expect(v.getUint32(24, true)).toBe(16000);
    expect(buf.byteLength).toBe(44 + 32000);
  });
});

describe("splitSentences", () => {
  it("la primera frase va sola para arrancar rápido", () => {
    const parts = splitSentences("Ey hermano. Hoy tienes tres reuniones. La primera es a las diez. Luego comes con tu madre.");
    expect(parts[0]).toBe("Ey hermano.");
    expect(parts.join(" ")).toBe("Ey hermano. Hoy tienes tres reuniones. La primera es a las diez. Luego comes con tu madre.");
  });
  it("corta frases muy largas por comas", () => {
    const long = Array.from({ length: 30 }, (_, i) => `parte ${i}`).join(", ") + ".";
    expect(splitSentences(long, 80).every((p) => p.length <= 90)).toBe(true);
  });
});
