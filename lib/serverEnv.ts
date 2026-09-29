import "server-only";
import { looksLikePlaceholder, isMockMode } from "./env";

/** Lee una variable secreta; devuelve null si falta o es un valor de ejemplo. */
export function secret(name: string): string | null {
  const v = process.env[name];
  return looksLikePlaceholder(v) ? null : (v as string).trim();
}

export const serverEnv = {
  get ownerEmails(): string[] {
    return (process.env.OWNER_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  get ownerDiscountCode(): string {
    return (process.env.OWNER_DISCOUNT_CODE ?? "PANCHAN100").trim().toUpperCase();
  },
  get serviceRoleKey() {
    return isMockMode ? null : secret("SUPABASE_SERVICE_ROLE_KEY");
  },
};
