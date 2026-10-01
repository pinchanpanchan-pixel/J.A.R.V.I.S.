import "server-only";
import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getServerFeatures } from "@/lib/auth/serverPlan";
import { isMockMode } from "@/lib/env";
import { isOwnerEmail } from "@/lib/owner";
import { serverEnv } from "@/lib/serverEnv";

/**
 * Guardia de las rutas de propietario (/api/admin/*, futura app de propietario).
 * Exige sesión Y que el email esté en la lista de propietarios Y la marca del servidor.
 * Devuelve el usuario o una respuesta 401/403 lista para devolver.
 */
export async function requireOwner(req: Request): Promise<{ user: { id: string; email: string } } | { response: NextResponse }> {
  const user = await getRequestUser(req);
  if (!user) return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const byEmail = isOwnerEmail(user.email, serverEnv.ownerEmails);
  const byFlag = isMockMode ? byEmail : (await getServerFeatures(user.id)).isOwner;
  if (!byEmail || !byFlag) return { response: NextResponse.json({ error: "owners_only" }, { status: 403 }) };
  return { user };
}
