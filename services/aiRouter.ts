import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { open as unseal } from "@/lib/crypto";
import { secret } from "@/lib/serverEnv";
import type { AIProvider } from "@/types/db";
import type { ChatTurn, ProviderAttempt } from "@/lib/ai/types";

/**
 * aiRouter — elige el cerebro de cada petición.
 *  1. Primero las claves del USUARIO (ahorran coste al propietario), en round-robin.
 *  2. Después Claude con la clave del propietario (ANTHROPIC_API_KEY): el cerebro por defecto.
 *  3. Si un proveedor falla con 429/5xx/red (o clave inválida), pasa al siguiente.
 * Nunca se registran (log) claves ni textos cifrados.
 */
export const CLAUDE_MODEL = "claude-opus-5-5";

const DEFAULT_MODELS: Record<Exclude<AIProvider, "anthropic">, { env: string; model: string }> = {
  openai: { env: "OPENAI_CHAT_MODEL", model: "gpt-4o-mini" },
  gemini: { env: "GEMINI_CHAT_MODEL", model: "gemini-2.0-flash" },
  groq: { env: "GROQ_CHAT_MODEL", model: "llama-3.3-70b-versatile" },
  openrouter: { env: "OPENROUTER_CHAT_MODEL", model: "openrouter/auto" },
};
const modelFor = (p: Exclude<AIProvider, "anthropic">) => process.env[DEFAULT_MODELS[p].env]?.trim() || DEFAULT_MODELS[p].model;

export class AIError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
  }
}

export class NoProviderError extends Error {}

export interface StoredKey {
  id: string;
  provider: AIProvider;
  key_ciphertext: string;
  enabled: boolean;
}

interface Candidate {
  provider: AIProvider;
  keyId: string;
  apiKey: string;
}

export interface ChatRequest {
  userId: string;
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  userKeys: StoredKey[];
}

export interface ChatResult {
  text: string;
  provider: AIProvider;
  keyId: string;
  model: string;
  attempts: ProviderAttempt[];
}

// Round-robin por usuario (en memoria de la instancia; suficiente para repartir carga).
const rr = new Map<string, number>();

export function ownerAnthropicKey(): string | null {
  return secret("ANTHROPIC_API_KEY");
}

/** Orden de candidatos: claves del usuario rotadas + la del propietario al final. */
export function buildCandidates(userId: string, keys: StoredKey[], owner: string | null): Candidate[] {
  const usable: Candidate[] = [];
  for (const k of keys) {
    if (!k.enabled) continue;
    try {
      usable.push({ provider: k.provider, keyId: k.id, apiKey: unseal(k.key_ciphertext, "ai_key", userId) });
    } catch {
      /* clave corrupta o de otro usuario: se ignora */
    }
  }
  const start = usable.length ? (rr.get(userId) ?? 0) % usable.length : 0;
  rr.set(userId, start + 1);
  const rotated = [...usable.slice(start), ...usable.slice(0, start)];
  if (owner) rotated.push({ provider: "anthropic", keyId: "owner", apiKey: owner });
  return rotated;
}

function classify(status: number): boolean {
  // 429 y 5xx: reintentable en otro proveedor. 401/403: clave inválida -> también se salta.
  return status === 429 || status >= 500 || status === 401 || status === 403 || status === 0 || status === 408;
}

async function callAnthropic(c: Candidate, req: ChatRequest): Promise<{ text: string; model: string }> {
  const client = new Anthropic({ apiKey: c.apiKey, maxRetries: 0, timeout: 45_000 });
  try {
    const response = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: req.maxTokens ?? 2000,
      // Conversación por voz: esfuerzo bajo = respuestas rápidas y concisas.
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    if (response.stop_reason === "refusal") {
      return { text: "Eso no te lo puedo responder, hermano. Pregúntame otra cosa.", model: response.model };
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { text, model: response.model };
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new AIError(e.message, e.status ?? 0, classify(e.status ?? 0));
    throw new AIError(e instanceof Error ? e.message : "network", 0, true);
  }
}

async function callOpenAICompatible(c: Candidate, req: ChatRequest, baseUrl: string): Promise<{ text: string; model: string }> {
  const model = modelFor(c.provider as Exclude<AIProvider, "anthropic">);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${c.apiKey}`,
      "content-type": "application/json",
      ...(c.provider === "openrouter" ? { "x-title": "J.A.R.V.I.S." } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 2000,
      messages: [{ role: "system", content: req.system }, ...req.messages],
    }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null);
  if (!res) throw new AIError("network", 0, true);
  if (!res.ok) throw new AIError(`${c.provider} ${res.status}`, res.status, classify(res.status));
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string };
  return { text: (j.choices?.[0]?.message?.content ?? "").trim(), model: j.model ?? model };
}

async function callGemini(c: Candidate, req: ChatRequest): Promise<{ text: string; model: string }> {
  const model = modelFor("gemini");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": c.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: req.maxTokens ?? 2000 },
    }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null);
  if (!res) throw new AIError("network", 0, true);
  if (!res.ok) throw new AIError(`gemini ${res.status}`, res.status, classify(res.status));
  const j = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return { text: (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim(), model };
}

async function callProvider(c: Candidate, req: ChatRequest) {
  switch (c.provider) {
    case "anthropic":
      return callAnthropic(c, req);
    case "openai":
      return callOpenAICompatible(c, req, "https://api.openai.com/v1");
    case "groq":
      return callOpenAICompatible(c, req, "https://api.groq.com/openai/v1");
    case "openrouter":
      return callOpenAICompatible(c, req, "https://openrouter.ai/api/v1");
    case "gemini":
      return callGemini(c, req);
  }
}

/** Conversación con fallback entre proveedores. Lanza NoProviderError si no hay ninguno configurado. */
export async function chat(req: ChatRequest, deps: { call?: typeof callProvider } = {}): Promise<ChatResult> {
  const candidates = buildCandidates(req.userId, req.userKeys, ownerAnthropicKey());
  if (candidates.length === 0) throw new NoProviderError("no_provider");
  const call = deps.call ?? callProvider;
  const attempts: ProviderAttempt[] = [];
  let lastError: AIError | null = null;
  for (const c of candidates) {
    try {
      const r = await call(c, req);
      if (!r.text) throw new AIError("empty_response", 502, true);
      attempts.push({ provider: c.provider, keyId: c.keyId, ok: true });
      return { ...r, provider: c.provider, keyId: c.keyId, attempts };
    } catch (e) {
      const err = e instanceof AIError ? e : new AIError(String(e), 0, true);
      attempts.push({ provider: c.provider, keyId: c.keyId, ok: false, status: err.status, error: err.message.slice(0, 200) });
      lastError = err;
      if (!err.retryable) break; // 400: la petición es mala, no insistir con otros
    }
  }
  const e = new AIError(lastError?.message ?? "all_failed", lastError?.status ?? 502, false) as AIError & { attempts: ProviderAttempt[] };
  e.attempts = attempts;
  throw e;
}

/** Cliente de Claude para visión y análisis estructurado (clave del propietario o del usuario). */
export function claudeClientFor(userId: string, keys: StoredKey[]): Anthropic | null {
  const userClaude = buildCandidates(userId, keys.filter((k) => k.provider === "anthropic"), null)[0];
  const key = userClaude?.apiKey ?? ownerAnthropicKey();
  return key ? new Anthropic({ apiKey: key, maxRetries: 1, timeout: 60_000 }) : null;
}
