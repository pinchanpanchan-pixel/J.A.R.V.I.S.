import { NextResponse } from "next/server";
import { z } from "zod";
import { open } from "@/lib/crypto";
import { getRequestUser } from "@/lib/auth/requestUser";

export const dynamic = "force-dynamic";

const Body = z.object({ ciphertexts: z.array(z.string().max(400_000)).max(500) });

/**
 * Descifra entradas del DIARIO del propio usuario. Las claves de IA y los tokens
 * OAuth NO se pueden descifrar desde aquí: solo el backend las usa.
 */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const plaintexts = parsed.data.ciphertexts.map((c) => {
    try {
      return open(c, "diary", user.id);
    } catch {
      return null;
    }
  });
  return NextResponse.json({ plaintexts });
}
