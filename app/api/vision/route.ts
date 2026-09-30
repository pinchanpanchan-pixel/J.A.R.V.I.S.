import { NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { getServerFeatures } from "@/lib/auth/serverPlan";
import { loadUserKeys } from "@/lib/ai/userKeys";
import { rateLimit } from "@/lib/rateLimit";
import { CLAUDE_MODEL, claudeClientFor } from "@/services/aiRouter";
import { geminiJson } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VisionSchema = z.object({
  title: z.string().describe("Título corto (máx. 6 palabras)"),
  description: z.string().describe("Descripción útil para recordarla en el futuro (2-3 frases)"),
  ocr_text: z.string().describe("Todo el texto legible de la imagen, literal; vacío si no hay"),
  objects: z.array(z.string()).describe("Objetos/elementos principales (máx. 10)"),
  faces_count: z.number().int().describe("Número de caras de personas visibles"),
  tags: z.array(z.string()).describe("Etiquetas en minúsculas (máx. 6)"),
});
export type VisionResult = z.infer<typeof VisionSchema>;

const Body = z.object({
  image: z.string().max(8_000_000), // base64 JPEG (el cliente la reduce a 1568 px)
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
  context: z.string().max(500).optional(), // fecha/lugar del EXIF
  keys: z.unknown().optional(),
});

/** Memoria visual con Gemini (o Claude): descripción, OCR, objetos y caras. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`vision:${user.id}`, 12)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { features } = await getServerFeatures(user.id);
  if (!features.vision) return NextResponse.json({ error: "plan_required" }, { status: 402 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { image, mediaType, context, keys } = parsed.data;

  const prompt = `Analiza esta foto para guardarla en la memoria personal de su dueño. Responde en español.${context ? ` Contexto: ${context}.` : ""} No identifiques a personas por su nombre; solo cuéntalas.`;
  const fromGemini = await geminiJson(VisionSchema, {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: mediaType, data: image } }, { text: prompt }] }],
    timeoutMs: 45_000,
  });
  if (fromGemini) return NextResponse.json({ result: fromGemini, source: "gemini" });

  const client = claudeClientFor(user.id, await loadUserKeys(user.id, keys));
  if (!client) {
    const result: VisionResult = {
      title: "Foto guardada",
      description: "Foto guardada en tu memoria. La descripción automática no está disponible ahora mismo.",
      ocr_text: "",
      objects: [],
      faces_count: 0,
      tags: ["foto"],
    };
    return NextResponse.json({ result, source: "mock" });
  }
  try {
    const response = await client.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(VisionSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return NextResponse.json({ error: "vision_refused" }, { status: 422 });
    return NextResponse.json({ result: response.parsed_output, source: "claude" });
  } catch {
    return NextResponse.json({ error: "vision_failed" }, { status: 502 });
  }
}
