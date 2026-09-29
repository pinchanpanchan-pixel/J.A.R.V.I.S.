"use client";
import { stableId } from "@/lib/ids";
import type { AuthUser } from "./types";

/**
 * Autenticación SIMULADA (sin Supabase). El id del usuario se deriva del email,
 * así que la misma cuenta en dos ventanas/dispositivos simulados comparte datos.
 */
const KEY = "jarvis.mockSession";
const EVENT = "jarvis-mock-auth";

export function mockUserId(email: string): string {
  return stableId("jarvis-mock-user", email.trim().toLowerCase());
}

export function getMockSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function mockSignIn(email: string, provider: AuthUser["provider"] = "mock"): AuthUser {
  const clean = email.trim().toLowerCase();
  const user: AuthUser = { id: mockUserId(clean), email: clean, provider };
  window.localStorage.setItem(KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(EVENT));
  return user;
}

export function mockSignOut() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function onMockAuthChange(fn: () => void): () => void {
  const storage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", storage);
  };
}
