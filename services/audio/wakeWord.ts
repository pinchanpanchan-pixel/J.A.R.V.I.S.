/**
 * Palabra de activación: «J.A.R.V.I.S.», «Hey J.A.R.V.I.S.» o CUALQUIER nombre que el
 * usuario haya elegido en el paso 1 (si le llama Friday, la palabra es «Friday»).
 */
export function normalizeWake(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9ñ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "J.A.R.V.I.S." -> "jarvis";  "Señor Stark" -> "senor stark" */
export function wakeName(assistantName: string): string {
  return normalizeWake(assistantName.replace(/\./g, "")) || "jarvis";
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Variantes con las que el reconocedor suele confundir «jarvis». */
const KNOWN_ALIASES: Record<string, string[]> = {
  jarvis: ["jarbis", "yarvis", "harvis", "jarvi", "charvis", "garvis", "jervis", "travis"],
};

const PREFIXES = ["hey", "ey", "oye", "hola", "ok", "okey", "eh"];

export interface WakeMatch {
  matched: boolean;
  /** Lo que se dijo DESPUÉS de la palabra de activación (p.ej. «Hey Jarvis, apaga la luz» -> «apaga la luz»). */
  command: string;
}

/** ¿El texto contiene la palabra de activación? Tolera 1 error en nombres de 5+ letras. */
export function matchWake(transcript: string, assistantName: string): WakeMatch {
  const name = wakeName(assistantName);
  const nameWords = name.split(" ");
  const words = normalizeWake(transcript).split(" ").filter(Boolean);
  const aliases = new Set([name, ...(KNOWN_ALIASES[name] ?? [])]);
  const tolerance = name.replace(/ /g, "").length >= 5 ? 1 : 0;

  for (let i = 0; i + nameWords.length <= words.length; i++) {
    const cand = words.slice(i, i + nameWords.length).join(" ");
    const ok = aliases.has(cand) || (tolerance > 0 && levenshtein(cand, name) <= tolerance);
    if (!ok) continue;
    // Solo cuenta si va al principio o precedido de un saludo («hey friday»), para no
    // activarse cuando el nombre sale en mitad de una conversación.
    if (i === 0 || (i === 1 && PREFIXES.includes(words[0])) || (i === 2 && PREFIXES.includes(words[1]))) {
      return { matched: true, command: words.slice(i + nameWords.length).join(" ") };
    }
  }
  return { matched: false, command: "" };
}
