import type { AIProvider } from "@/types/db";

export const AI_PROVIDERS: Array<{ id: AIProvider; name: string; hint: string; keyPrefix: string }> = [
  { id: "anthropic", name: "Anthropic (Claude)", hint: "sk-ant-…", keyPrefix: "sk-ant-" },
  { id: "openai", name: "OpenAI", hint: "sk-…", keyPrefix: "sk-" },
  { id: "gemini", name: "Google Gemini", hint: "AIza…", keyPrefix: "AIza" },
  { id: "groq", name: "Groq", hint: "gsk_…", keyPrefix: "gsk_" },
  { id: "openrouter", name: "OpenRouter", hint: "sk-or-…", keyPrefix: "sk-or-" },
];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Resultado de un intento contra un proveedor (para actualizar fail_count / last_error en el cliente). */
export interface ProviderAttempt {
  provider: AIProvider;
  keyId: string; // id de ai_provider_keys o "owner"
  ok: boolean;
  status?: number;
  error?: string;
}
