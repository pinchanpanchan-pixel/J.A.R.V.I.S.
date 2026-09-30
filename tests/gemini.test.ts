import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { z } from "zod";
import { geminiGenerate, geminiJson, GeminiError } from "@/lib/ai/gemini";

const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const fail = (status: number, message: string) => new Response(JSON.stringify({ error: { message } }), { status });
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

describe("gemini", () => {
  it("baja el nivel de razonamiento si el modelo no lo admite", async () => {
    const f = vi.fn().mockResolvedValueOnce(fail(400, "Thinking level MINIMAL is not supported for this model.")).mockResolvedValueOnce(ok("hola"));
    const r = await geminiGenerate({ apiKey: "k", contents: [{ role: "user", parts: [{ text: "x" }] }], models: ["m-ladder"] }, f as never);
    expect(r).toMatchObject({ text: "hola", model: "m-ladder" });
    expect(bodyOf(f.mock.calls[0]).generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect(bodyOf(f.mock.calls[1]).generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  it("pasa al siguiente modelo con 503 o 429 y envía la clave en cabecera", async () => {
    const f = vi.fn().mockResolvedValueOnce(fail(503, "high demand")).mockResolvedValueOnce(ok("vale"));
    const r = await geminiGenerate({ apiKey: "secreta", contents: [{ role: "user", parts: [{ text: "x" }] }], models: ["a1", "b1"] }, f as never);
    expect(r.model).toBe("b1");
    expect(String(f.mock.calls[0][0])).not.toContain("secreta");
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "x-goog-api-key": "secreta" });
  });

  it("con 401 no insiste y lanza el estado", async () => {
    const f = vi.fn().mockResolvedValue(fail(401, "bad key"));
    await expect(geminiGenerate({ apiKey: "k", contents: [], models: ["c1", "d1"] }, f as never)).rejects.toBeInstanceOf(GeminiError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("geminiJson valida la salida con el esquema", async () => {
    const S = z.object({ title: z.string() });
    const good = vi.fn().mockResolvedValue(ok('```json\n{"title":"Playa"}\n```'));
    expect(await geminiJson(S, { apiKey: "k", contents: [], models: ["e1"] }, good as never)).toEqual({ title: "Playa" });
    const bad = vi.fn().mockResolvedValue(ok('{"nope":1}'));
    expect(await geminiJson(S, { apiKey: "k", contents: [], models: ["e1"] }, bad as never)).toBeNull();
  });
});
