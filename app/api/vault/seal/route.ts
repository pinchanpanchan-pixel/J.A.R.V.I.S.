import { NextResponse } from "next/server";
import { z } from "zod";
import { last4, seal } from "@/lib/crypto";
import { getRequestUser } from "@/lib/auth/requestUser";

export const dynamic = "force-dynamic";

const Body = z.object({
  value: z.string().min(1).max(200_000),
  purpose: z.enum(["diary", "ai_key", "oauth", "generic"]),
});

/** Cifra un secreto para el usuario actual. Devuelve solo el texto cifrado y los 4 últimos caracteres. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { value, purpose } = parsed.data;
  return NextResponse.json({
    ciphertext: seal(value, purpose, user.id),
    last4: purpose === "diary" ? null : last4(value),
  });
}
