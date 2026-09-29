// GENERADO por scripts/sync_edge_shared.mjs — no editar a mano.
/** Identificadores generados en el cliente (necesario para escribir offline). */

export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

function formatUuid(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * UUID determinista a partir de un texto (mismo resultado en todos los dispositivos).
 * Se usa para filas "únicas por usuario" (p.ej. conector Spotify del usuario X),
 * de modo que dos dispositivos que la crean offline acaban en la misma fila.
 */
export function stableId(...parts: string[]): string {
  const input = parts.join("␟");
  // 4 x 32-bit hashes (cyrb128) -> 128 bits
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const words = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  const b = new Uint8Array(16);
  words.forEach((w, i) => {
    b[i * 4] = (w >>> 24) & 0xff;
    b[i * 4 + 1] = (w >>> 16) & 0xff;
    b[i * 4 + 2] = (w >>> 8) & 0xff;
    b[i * 4 + 3] = w & 0xff;
  });
  b[6] = (b[6] & 0x0f) | 0x50; // versión 5 "estilo"
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

export const nowIso = () => new Date().toISOString();
