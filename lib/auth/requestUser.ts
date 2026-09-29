import "server-only";
import { isMockMode } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Usuario de la petición. En producción, SIEMPRE desde la sesión de Supabase.
 * En modo simulado se acepta la cabecera x-jarvis-mock-user (no hay servidor de auth).
 */
export async function getRequestUser(req: Request): Promise<{ id: string; email: string } | null> {
  if (isMockMode) {
    const id = req.headers.get("x-jarvis-mock-user");
    const email = req.headers.get("x-jarvis-mock-email") ?? "";
    return id && /^[0-9a-f-]{36}$/i.test(id) ? { id, email } : null;
  }
  const sb = getSupabaseServer();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? { id: user.id, email: user.email ?? "" } : null;
}
