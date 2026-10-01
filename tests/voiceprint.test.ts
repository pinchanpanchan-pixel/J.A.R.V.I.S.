import { describe, it, expect } from "vitest";
import { embedding, enroll, similarity, suggestThreshold, VOICEPRINT_RATE } from "@/services/audio/voiceprint";

/** Voz sintética: tren de pulsos glotales (F0) filtrado por formantes (vocales), con jitter. */
function synthVoice(f0: number, formantScale: number, vowels: number[][], seed: number): Float32Array {
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const out = new Float32Array(VOICEPRINT_RATE * vowels.length * 0.4);
  let phase = 0;
  const per = out.length / vowels.length;
  const state = vowels[0].map(() => [0, 0]);
  for (let i = 0; i < out.length; i++) {
    const v = vowels[Math.min(vowels.length - 1, Math.floor(i / per))];
    const f = f0 * (1 + 0.03 * Math.sin(i / 900) + 0.01 * (rand() - 0.5));
    phase += f / VOICEPRINT_RATE;
    let x = phase >= 1 ? 1 : 0;
    if (phase >= 1) phase -= 1;
    x += 0.02 * (rand() - 0.5);
    let y = 0;
    v.forEach((fc, k) => {
      const r = 0.97;
      const w = (2 * Math.PI * fc * formantScale) / VOICEPRINT_RATE;
      const s = state[k];
      const o = x + 2 * r * Math.cos(w) * s[0] - r * r * s[1];
      s[1] = s[0];
      s[0] = o;
      y += o * 0.05;
    });
    out[i] = Math.tanh(y);
  }
  return out;
}

const A = [700, 1220, 2600];
const E = [400, 2000, 2550];
const O = [450, 800, 2830];

describe("huella de voz", () => {
  it("se parece más a sí misma que a otra voz", () => {
    const me = [synthVoice(110, 1, [A, E, O], 1), synthVoice(115, 1, [O, A, E], 2), synthVoice(108, 1, [E, O, A], 3)].map((p) => embedding(p)!);
    const print = enroll(me)!;
    const mine = embedding(synthVoice(112, 1, [A, O, E], 9))!;
    const other = embedding(synthVoice(210, 1.2, [A, O, E], 9))!;
    expect(similarity(mine, print)).toBeGreaterThan(similarity(other, print));
    const th = suggestThreshold(me, print);
    expect(th).toBeGreaterThanOrEqual(0.6);
    expect(similarity(mine, print)).toBeGreaterThan(similarity(other, print) + 0.02);
  });

  it("sin voz suficiente no hay huella", () => {
    expect(embedding(new Float32Array(1000))).toBeNull();
  });
});
