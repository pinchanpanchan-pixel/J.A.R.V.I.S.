"use client";
import { isMockMode } from "@/lib/env";
import { getMockSession } from "@/lib/auth/mockAuth";

/** fetch a nuestras rutas /api con la identidad del usuario (cookies en producción). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (isMockMode) {
    const s = getMockSession();
    if (s) {
      headers.set("x-jarvis-mock-user", s.id);
      headers.set("x-jarvis-mock-email", s.email);
    }
  }
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export async function sealSecret(value: string, purpose: "diary" | "ai_key" | "oauth" | "generic") {
  return apiJson<{ ciphertext: string; last4: string | null }>("/api/vault/seal", {
    method: "POST",
    body: JSON.stringify({ value, purpose }),
  });
}

export async function openDiary(ciphertexts: string[]): Promise<Array<string | null>> {
  if (ciphertexts.length === 0) return [];
  const r = await apiJson<{ plaintexts: Array<string | null> }>("/api/vault/open", {
    method: "POST",
    body: JSON.stringify({ ciphertexts }),
  });
  return r.plaintexts;
}
