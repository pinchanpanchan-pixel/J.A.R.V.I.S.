/**
 * Huella de voz del dueño (lógica pura, testeable).
 *
 * Cómo funciona: de cada frase se sacan los MFCC (cómo reparte la voz la energía entre
 * frecuencias, que depende del tracto vocal de cada persona) y su variación, solo en las
 * tramas con voz. La huella es la media de varias frases; al hablar se compara con la
 * similitud del coseno.
 *
 * Límites (honestos): NO es biometría segura como Face ID o «Oye Siri». Un resfriado, un
 * micrófono distinto o mucho ruido bajan la similitud; una grabación del dueño o una voz
 * muy parecida pueden pasar el filtro. Sirve para que no responda a la tele ni a otras
 * personas en casa, no para proteger datos.
 */

export const VOICEPRINT_RATE = 16_000;
const FRAME = 400; // 25 ms
const HOP = 160; // 10 ms
const NFFT = 512;
const MELS = 26;
const CEPS = 13;

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2];
        const ai = im[i + k + len / 2];
        const xr = ar * wr - ai * wi;
        const xi = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

const hz2mel = (f: number) => 2595 * Math.log10(1 + f / 700);
const mel2hz = (m: number) => 700 * (10 ** (m / 2595) - 1);

let filters: Float64Array[] | null = null;
function melFilters(): Float64Array[] {
  if (filters) return filters;
  const lo = hz2mel(80);
  const hi = hz2mel(7600);
  const pts = Array.from({ length: MELS + 2 }, (_, i) => Math.floor(((NFFT + 1) * mel2hz(lo + ((hi - lo) * i) / (MELS + 1))) / VOICEPRINT_RATE));
  filters = Array.from({ length: MELS }, (_, m) => {
    const f = new Float64Array(NFFT / 2 + 1);
    for (let k = pts[m]; k < pts[m + 1]; k++) f[k] = (k - pts[m]) / Math.max(1, pts[m + 1] - pts[m]);
    for (let k = pts[m + 1]; k < pts[m + 2]; k++) f[k] = (pts[m + 2] - k) / Math.max(1, pts[m + 2] - pts[m + 1]);
    return f;
  });
  return filters;
}

/** MFCC de las tramas con voz (descarta silencio y ruido de fondo). */
export function mfccFrames(pcm: Float32Array): number[][] {
  const out: Array<{ c: number[]; e: number }> = [];
  const win = Array.from({ length: FRAME }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
  const fb = melFilters();
  for (let start = 0; start + FRAME <= pcm.length; start += HOP) {
    const re = new Float64Array(NFFT);
    const im = new Float64Array(NFFT);
    let energy = 0;
    for (let i = 0; i < FRAME; i++) {
      // pre-énfasis + ventana
      const x = pcm[start + i] - 0.97 * (start + i > 0 ? pcm[start + i - 1] : 0);
      re[i] = x * win[i];
      energy += pcm[start + i] * pcm[start + i];
    }
    fft(re, im);
    const logMel = fb.map((f) => {
      let s = 0;
      for (let k = 0; k <= NFFT / 2; k++) if (f[k]) s += f[k] * (re[k] * re[k] + im[k] * im[k]);
      return Math.log(s + 1e-10);
    });
    const c: number[] = [];
    for (let n = 0; n < CEPS; n++) {
      let s = 0;
      for (let m = 0; m < MELS; m++) s += logMel[m] * Math.cos((Math.PI * n * (m + 0.5)) / MELS);
      c.push(s);
    }
    out.push({ c, e: energy / FRAME });
  }
  if (out.length === 0) return [];
  // Tramas con voz: energía por encima del 40 % superior (relativo a la propia frase).
  const sorted = out.map((f) => f.e).sort((a, b) => a - b);
  const gate = Math.max(sorted[Math.floor(sorted.length * 0.6)] ?? 0, 1e-6);
  return out.filter((f) => f.e >= gate).map((f) => f.c);
}

/** Huella de una frase: media y desviación de c1..c12 y media de sus deltas. null si hay poca voz. */
export function embedding(pcm: Float32Array): number[] | null {
  const frames = mfccFrames(pcm);
  if (frames.length < 20) return null; // menos de ~0,2 s de voz
  const dims = CEPS - 1;
  const mean = new Array(dims).fill(0);
  const sq = new Array(dims).fill(0);
  const delta = new Array(dims).fill(0);
  frames.forEach((c, t) => {
    for (let d = 0; d < dims; d++) {
      mean[d] += c[d + 1];
      sq[d] += c[d + 1] * c[d + 1];
      if (t > 0) delta[d] += Math.abs(c[d + 1] - frames[t - 1][d + 1]);
    }
  });
  const n = frames.length;
  const vec = [
    ...mean.map((m) => m / n),
    ...sq.map((s, d) => Math.sqrt(Math.max(0, s / n - (mean[d] / n) ** 2))),
    ...delta.map((s) => s / (n - 1)),
  ];
  return normalize(vec);
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => Math.round((x / norm) * 1e5) / 1e5);
}

export function similarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // ambos normalizados
}

/** Huella final: media de las frases grabadas en el onboarding. */
export function enroll(samples: number[][]): number[] | null {
  const ok = samples.filter((s) => s.length > 0);
  if (ok.length === 0) return null;
  const avg = ok[0].map((_, i) => ok.reduce((s, v) => s + v[i], 0) / ok.length);
  return normalize(avg);
}

/** Exigencia propuesta tras grabar: un poco por debajo de lo que se parecen entre sí las frases del dueño. */
export function suggestThreshold(samples: number[][], print: number[]): number {
  const sims = samples.map((s) => similarity(s, print));
  const min = Math.min(...sims);
  return Math.round(Math.min(0.95, Math.max(0.6, min - 0.04)) * 100) / 100;
}

/** PCM a 16 kHz mono desde un WAV de PhraseCapture (cabecera de 44 bytes, 16 bits). */
export function wavToPcm(buf: ArrayBuffer): Float32Array {
  const view = new DataView(buf);
  const n = Math.floor((buf.byteLength - 44) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getInt16(44 + i * 2, true) / 32768;
  return out;
}
