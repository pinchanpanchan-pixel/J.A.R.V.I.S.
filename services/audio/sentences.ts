/**
 * Trocea la respuesta en frases para el TTS en streaming: la primera frase empieza a
 * sonar en cuanto está lista (latencia percibida baja) y las siguientes se precargan.
 */
export function splitSentences(text: string, maxLen = 220): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?…;:]+[.!?…;:]*["»)]?\s*/g) ?? [clean];
  const out: string[] = [];
  let buf = "";
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (p.length > maxLen) {
      if (buf) out.push(buf), (buf = "");
      // frase muy larga: corta por comas
      let chunk = "";
      for (const piece of p.split(/(?<=,)\s*/)) {
        if ((chunk + " " + piece).trim().length > maxLen && chunk) {
          out.push(chunk.trim());
          chunk = piece;
        } else chunk = `${chunk} ${piece}`.trim();
      }
      if (chunk) out.push(chunk);
      continue;
    }
    // La primera frase va sola (arranque rápido); las demás se agrupan hasta maxLen.
    if (out.length === 0 && !buf) {
      out.push(p);
      continue;
    }
    if ((buf + " " + p).trim().length > maxLen) {
      out.push(buf);
      buf = p;
    } else buf = `${buf} ${p}`.trim();
  }
  if (buf) out.push(buf);
  return out;
}
