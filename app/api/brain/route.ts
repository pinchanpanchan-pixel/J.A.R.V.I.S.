import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { mockReply } from "@/lib/brain/mockBrain";

export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().min(1).max(8000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(40).default([]),
  context: z
    .object({
      userName: z.string().max(60).default("hermano"),
      assistantName: z.string().max(60).default("J.A.R.V.I.S."),
      memories: z.array(z.string().max(2000)).max(20).default([]),
    })
    .default({ userName: "hermano", assistantName: "J.A.R.V.I.S.", memories: [] }),
});

/** Cerebro. Fase 2: respuesta simulada. Fase 4: aiRouter (Claude + proveedores del usuario + fallback). */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { message, context } = parsed.data;
  return NextResponse.json({ reply: mockReply(message, context), provider: "mock" });
}
