import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getServerFeatures } from "@/lib/auth/serverPlan";
import { mockReply } from "@/lib/brain/mockBrain";
import { systemPrompt } from "@/lib/brain/persona";
import { loadUserKeys } from "@/lib/ai/userKeys";
import { rateLimit } from "@/lib/rateLimit";
import { chat, NoProviderError, type AIError } from "@/services/aiRouter";
import type { ProviderAttempt } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  message: z.string().min(1).max(8000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(40).default([]),
  context: z
    .object({
      userName: z.string().max(60).default("hermano"),
      assistantName: z.string().max(60).default("J.A.R.V.I.S."),
      memories: z.array(z.string().max(2000)).max(20).default([]),
      facts: z.array(z.string().max(500)).max(50).default([]),
      location: z.string().max(200).nullable().default(null),
      timezone: z.string().max(60).nullable().default(null),
      /** Datos extra que aporta una skill (agenda, notas de ayer…). */
      extra: z.string().max(20000).nullable().default(null),
    })
    .default({ userName: "hermano", assistantName: "J.A.R.V.I.S.", memories: [], facts: [], location: null, timezone: null, extra: null }),
  keys: z.unknown().optional(),
});

/** Cerebro: aiRouter (claves del usuario → Claude del propietario → fallback). Sin claves: simulado. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`brain:${user.id}`, 30)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { message, history, context, keys } = parsed.data;

  const { features } = await getServerFeatures(user.id);
  // Multi-proveedor es de Pro: en otros planes solo se usa el cerebro por defecto.
  const userKeys = features.multiProvider ? await loadUserKeys(user.id, keys) : [];

  const system = systemPrompt({
    assistantName: context.assistantName,
    userName: context.userName,
    facts: context.facts,
    memories: context.memories,
    location: context.location,
    timezone: context.timezone,
  }) + (context.extra ? `\n\nDatos para responder (úsalos, no los recites enteros):\n${context.extra}` : "");

  // La API exige empezar por "user": se descartan asistentes iniciales del historial.
  const turns = [...history, { role: "user" as const, content: message }];
  while (turns.length && turns[0].role !== "user") turns.shift();

  try {
    const r = await chat({ userId: user.id, system, messages: turns, userKeys });
    return NextResponse.json({ reply: r.text, provider: r.provider, keyId: r.keyId, model: r.model, attempts: r.attempts });
  } catch (e) {
    if (e instanceof NoProviderError) {
      return NextResponse.json({ reply: mockReply(message, context), provider: "mock", keyId: null, attempts: [] });
    }
    const err = e as AIError & { attempts?: ProviderAttempt[] };
    // Todos los proveedores fallaron: respuesta amable + intentos (el cliente anota los fallos de cada clave)
    return NextResponse.json({
      reply: "Tengo los circuitos saturados ahora mismo, hermano. Dame un minuto y vuelve a probar.",
      provider: "none",
      keyId: null,
      degraded: true,
      attempts: err.attempts ?? [],
    });
  }
}
