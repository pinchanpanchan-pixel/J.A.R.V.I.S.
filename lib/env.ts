/**
 * Configuración pública (disponible en cliente y servidor).
 * El MODO SIMULADO se activa si NEXT_PUBLIC_MOCK_MODE=true o si las claves
 * de Supabase son las de ejemplo de .env.example.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function looksLikePlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim();
  return (
    v === "" ||
    v.includes("SIMULADA") ||
    v.includes("tu-proyecto") ||
    v.endsWith("...") ||
    v.includes("...") ||
    v === "sb-..."
  );
}

function computeMockMode(): boolean {
  const flag = (process.env.NEXT_PUBLIC_MOCK_MODE ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return looksLikePlaceholder(SUPABASE_URL) || looksLikePlaceholder(SUPABASE_ANON_KEY);
}

export const publicEnv = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  mockMode: computeMockMode(),
} as const;

export const isMockMode = publicEnv.mockMode;
