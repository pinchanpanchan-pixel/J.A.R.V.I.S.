import "server-only";
import { looksLikePlaceholder, isMockMode } from "./env";
import { parseOwnerEmails } from "./owner";

/** Lee una variable secreta; devuelve null si falta o es un valor de ejemplo. */
export function secret(name: string): string | null {
  const v = process.env[name];
  return looksLikePlaceholder(v) ? null : (v as string).trim();
}

export const serverEnv = {
  /** Lista por defecto (los dos propietarios) + OWNER_EMAILS. */
  get ownerEmails(): string[] {
    return parseOwnerEmails(process.env.OWNER_EMAILS);
  },
  get serviceRoleKey() {
    return isMockMode ? null : secret("SUPABASE_SERVICE_ROLE_KEY");
  },
};
