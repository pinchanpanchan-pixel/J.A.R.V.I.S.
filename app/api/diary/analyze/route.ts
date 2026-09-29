import { NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getRequestUser } from "@/lib/auth/requestUser";
import { loadUserKeys } from "@/lib/ai/userKeys";
import { rateLimit } from "@/lib/rateLimit";
import { seal } from "@/lib/crypto";
import { DiaryAnalysisSchema, heuristicAnalysis, type DiaryAnalysis } from "@/lib/diary/analysis";
import { CLAUDE_MODEL, claudeClientFor } from "@/services/aiRouter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ text: z.string().min(1).max(20000), userName: z.string().max(60).default("hermano"), keys: z.unknown().optional() });

/**
 * Analiza una entrada del diario (sentimiento, emociones, momentos clave, pensamientos,
 * etiquetas, resumen) con Claude y devuelve el texto CIFRADO. El texto plano no se guarda.
 */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`diary:${user.id}`, 10)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { text, userName, keys } = parsed.data;

  let analysis: DiaryAnalysis | null = null;
  let source = "heuristic";
  const client = claudeClientFor(user.id, await loadUserKeys(user.id, keys));
  if (client) {
    try {
      const response = await client.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        output_config: { effort: "low", format: zodOutputFormat(DiaryAnalysisSchema) },
        system: `Eres el hermano mayor de ${userName} y lees su diario privado con cariño. Analiza la entrada con precisión y sin juzgar. Todo en español.`,
        messages: [{ role: "user", content: `Entrada del diario de hoy:\n\n${text}` }],
      });
      if (response.stop_reason !== "refusal" && response.parsed_output) {
        analysis = response.parsed_output;
        source = "claude";
      }
    } catch {
      analysis = null; // sin IA disponible: heurística
    }
  }
  analysis ??= heuristicAnalysis(text);
  analysis.sentiment = Math.max(-1, Math.min(1, analysis.sentiment));
  analysis.emotions = analysis.emotions.map((e) => e.toLowerCase()).slice(0, 4);
  analysis.tags = analysis.tags.map((t) => t.toLowerCase().replace(/^#/, "")).slice(0, 6);
  return NextResponse.json({ analysis, source, ciphertext: seal(text, "diary", user.id) });
}
