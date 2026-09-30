import "server-only";
import { z } from "zod";
import { secret } from "@/lib/serverEnv";

/**
 * Cliente mínimo de Google Gemini (API REST, capa gratuita).
 *  - Cadena de modelos: si uno está saturado (503), sin cuota (429) o ya no existe (404),
 *    se prueba el siguiente. Configurable con GEMINI_MODEL (lista separada por comas).
 *  - Razonamiento ("thinking") al mínimo para respuestas rápidas de voz. Cada familia acepta
 *    niveles distintos: si el modelo rechaza uno, se reintenta con el siguiente de la escalera.
 * Nunca se registran claves ni textos.
 */
export const DEFAULT_GEMINI_MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest"];

export function geminiModels(): string[] {
  const env = process.env.GEMINI_MODEL?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
  return env.length ? [...new Set([...env, ...DEFAULT_GEMINI_MODELS])] : DEFAULT_GEMINI_MODELS;
}

export function serverGeminiKey(): string | null {
  return secret("GEMINI_API_KEY");
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export interface GeminiRequest {
  apiKey: string;
  system?: string;
  contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }>;
  maxTokens?: number;
  /** Respuesta en JSON (análisis estructurado). */
  json?: boolean;
  models?: string[];
  timeoutMs?: number;
}

// Escalera de razonamiento: los "lite" aceptan minimal; los flash, low; si nada vale, sin config.
type Thinking = { thinkingLevel: string } | null;
const THINKING_LADDER: Thinking[] = [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }, null];
// Recuerda por modelo qué nivel funcionó (por instancia) para no repetir el 400 en cada petición.
const thinkingFor = new Map<string, number>();

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function once(model: string, thinking: Thinking, req: GeminiRequest, fetchImpl: typeof fetch) {
  const res = await fetchImpl(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": req.apiKey },
    body: JSON.stringify({
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents: req.contents,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 1024,
        ...(thinking ? { thinkingConfig: thinking } : {}),
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? 30_000),
  }).catch(() => null);
  if (!res) throw new GeminiError("network", 0);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const message = body?.error?.message?.slice(0, 200) ?? `gemini ${res.status}`;
    // Gemini responde 400 a una clave inválida: se trata como error de autenticación.
    throw new GeminiError(message, res.status === 400 && /api key/i.test(message) ? 401 : res.status);
  }
  const j = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  if (j.promptFeedback?.blockReason) return { text: "", blocked: true };
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  return { text: parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim(), blocked: j.candidates?.[0]?.finishReason === "SAFETY" };
}

const isThinkingRejection = (e: GeminiError) => e.status === 400 && /think|invalid argument/i.test(e.message);

/** Genera texto con la cadena de modelos. Lanza GeminiError con el último estado si todos fallan. */
export async function geminiGenerate(req: GeminiRequest, fetchImpl: typeof fetch = fetch): Promise<{ text: string; model: string; blocked?: boolean }> {
  let last: GeminiError = new GeminiError("no_model", 502);
  for (const model of req.models ?? geminiModels()) {
    let step = thinkingFor.get(model) ?? 0;
    while (step < THINKING_LADDER.length) {
      try {
        const r = await once(model, THINKING_LADDER[step], req, fetchImpl);
        thinkingFor.set(model, step);
        return { ...r, model };
      } catch (e) {
        const err = e instanceof GeminiError ? e : new GeminiError(String(e), 0);
        last = err;
        if (isThinkingRejection(err)) {
          step++;
          continue;
        }
        break; // 429/503/404/red: siguiente modelo
      }
    }
    // 400 que no es de razonamiento (petición mala) o 401/403 (clave mala): no insistir
    if ((last.status === 400 && !isThinkingRejection(last)) || last.status === 401 || last.status === 403) break;
  }
  throw last;
}

/**
 * Salida estructurada: pide JSON que cumpla el esquema (se describe en el prompt) y lo valida con zod.
 * Devuelve null si no hay clave, si Gemini falla o si el JSON no cumple el esquema.
 */
export async function geminiJson<T>(
  schema: z.ZodType<T>,
  req: Omit<GeminiRequest, "apiKey" | "json"> & { apiKey?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<T | null> {
  const apiKey = req.apiKey ?? serverGeminiKey();
  if (!apiKey) return null;
  const shape = JSON.stringify(z.toJSONSchema(schema));
  const system = `${req.system ?? ""}\nResponde SOLO con un objeto JSON que cumpla este JSON Schema:\n${shape}`.trim();
  try {
    const r = await geminiGenerate({ ...req, apiKey, system, json: true, maxTokens: req.maxTokens ?? 2048 }, fetchImpl);
    const raw = r.text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
