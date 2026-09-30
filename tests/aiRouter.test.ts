import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
import { chat, AIError, NoProviderError, buildCandidates, serverKeys } from "@/services/aiRouter";
import { seal } from "@/lib/crypto";

const U = "user-1";
const key = (id: string, provider: "openai" | "groq" | "anthropic", enabled = true) => ({ id, provider, enabled, key_ciphertext: seal(`secret-${id}`, "ai_key", U) });
const req = (keys: ReturnType<typeof key>[]) => ({ userId: U, system: "s", messages: [{ role: "user" as const, content: "hola" }], userKeys: keys });

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.AI_PRIMARY;
});

describe("aiRouter", () => {
  it("sin claves ni clave del propietario -> NoProviderError", async () => {
    await expect(chat(req([]))).rejects.toBeInstanceOf(NoProviderError);
  });

  it("usa primero las claves del usuario y la del propietario al final", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-owner-real";
    const c = buildCandidates("u-order", [key("a", "openai"), key("b", "groq")].map((k) => ({ ...k, key_ciphertext: seal(`x${k.id}`, "ai_key", "u-order") })), [{ provider: "anthropic", apiKey: "sk-ant-owner-real" }]);
    expect(c.map((x) => x.keyId)).toEqual(["a", "b", "owner"]);
  });

  it("round-robin entre claves del usuario", () => {
    const keys = [key("a", "openai"), key("b", "openai")].map((k) => ({ ...k, key_ciphertext: seal("k", "ai_key", "u-rr") }));
    const first = buildCandidates("u-rr", keys, [])[0].keyId;
    const second = buildCandidates("u-rr", keys, [])[0].keyId;
    expect(first).not.toBe(second);
  });

  it("ignora claves desactivadas o de otro usuario", () => {
    const foreign = { id: "f", provider: "openai" as const, enabled: true, key_ciphertext: seal("k", "ai_key", "otro") };
    const c = buildCandidates(U, [key("off", "openai", false), foreign], []);
    expect(c).toHaveLength(0);
  });

  it("fallback en 429 y 500 hasta el propietario", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-owner-real";
    const call = vi.fn(async (c: { keyId: string; apiKey: string }) => {
      if (c.keyId === "a") throw new AIError("rate", 429, true);
      if (c.keyId === "b") throw new AIError("boom", 500, true);
      return { text: `ok ${c.apiKey}`, model: "m" };
    });
    const r = await chat(req([key("a", "openai"), key("b", "groq")]), { call: call as never });
    expect(r.keyId).toBe("owner");
    expect(r.text).toBe("ok sk-ant-owner-real");
    const attempts = r.attempts.map((a) => [a.keyId, a.ok, a.status]);
    expect(attempts.at(-1)).toEqual(["owner", true, undefined]); // el propietario siempre al final
    expect(attempts.slice(0, 2)).toEqual(expect.arrayContaining([["a", false, 429], ["b", false, 500]]));
  });

  it("un 400 no se reintenta con otros proveedores", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-owner-real";
    const call = vi.fn(async () => {
      throw new AIError("bad", 400, false);
    });
    await expect(chat(req([key("a", "openai")]), { call: call as never })).rejects.toMatchObject({ status: 400 });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("Gemini del servidor va antes que Claude salvo AI_PRIMARY=anthropic", () => {
    process.env.GEMINI_API_KEY = "AIza-server-real";
    process.env.ANTHROPIC_API_KEY = "sk-ant-owner-real";
    expect(serverKeys().map((k) => k.provider)).toEqual(["gemini", "anthropic"]);
    process.env.AI_PRIMARY = "anthropic";
    expect(serverKeys().map((k) => k.provider)).toEqual(["anthropic", "gemini"]);
  });

  it("si todo acaba en 429 el error es de cuota (429)", async () => {
    const call = vi.fn(async () => {
      throw new AIError("quota", 429, true);
    });
    await expect(chat(req([]), { call: call as never, server: [{ provider: "gemini", apiKey: "k" }] })).rejects.toMatchObject({ status: 429 });
  });
});
