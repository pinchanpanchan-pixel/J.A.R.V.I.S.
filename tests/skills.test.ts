import { describe, it, expect, vi } from "vitest";
import { SyncEngine } from "@/lib/sync/engine";
import { memoryKVFactory } from "@/lib/sync/kv";
import { MockRemote } from "@/lib/sync/mockRemote";
import { featuresFor } from "@/lib/plans";
import { routeUtterance } from "@/skills";
import { effectiveShortcuts, matchShortcut } from "@/lib/shortcuts";
import type { SkillContext } from "@/skills/types";

const U = "22222222-2222-4222-8222-222222222222";

async function makeCtx(plan: "free" | "pro" = "pro") {
  const engine = new SyncEngine({ kvFactory: memoryKVFactory(), remote: new MockRemote(memoryKVFactory()) });
  await engine.start(U);
  const navigate = vi.fn();
  const openQuickNote = vi.fn();
  const askBrain = vi.fn(async (_m: string, extra: string) => `RESUMEN(${extra.split("\n").length})`);
  const connector = vi.fn(async () => ({ events: [], sample: true, ok: true }));
  const ctx: SkillContext = {
    engine, userId: U, userName: "Pancho", assistantName: "Friday", timezone: "Europe/Madrid",
    features: featuresFor(plan), navigate, openQuickNote, askBrain, connector: connector as never, now: () => new Date(),
  };
  return { ctx, engine, navigate, openQuickNote, askBrain };
}

describe("skills", () => {
  it("«apunta que…» guarda una nota rápida", async () => {
    const { ctx, engine } = await makeCtx();
    const r = await routeUtterance("Apunta que mañana llamo al dentista", ctx, []);
    expect(r?.reply).toBe("Apuntado, hermano.");
    expect((await engine.list("quick_notes"))[0].content).toBe("mañana llamo al dentista");
  });

  it("«crea nota rápida» sin contenido abre la hoja", async () => {
    const { ctx, openQuickNote } = await makeCtx();
    await routeUtterance("crea nota rápida", ctx, []);
    expect(openQuickNote).toHaveBeenCalled();
  });

  it("«recuerda que…» guarda recuerdo y hecho esencial", async () => {
    const { ctx, engine } = await makeCtx();
    await routeUtterance("recuerda que mi hermana se llama Lucía", ctx, []);
    expect((await engine.list("memory_blocks"))[0].content).toBe("mi hermana se llama Lucía");
    expect((await engine.get("user_core_memory", U))?.facts[0].fact).toBe("mi hermana se llama Lucía");
  });

  it("«qué hicimos ayer» usa el cerebro con los registros del día", async () => {
    const { ctx, engine, askBrain } = await makeCtx();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    await engine.insert("memory_blocks", { title: "Cine", content: "Vimos Dune", tags: [], source: "manual", metadata: {}, original_date: yesterday });
    const r = await routeUtterance("¿Qué hicimos ayer?", ctx, effectiveShortcuts([]));
    expect(askBrain).toHaveBeenCalled();
    expect(r?.reply).toMatch(/^RESUMEN/);
  });

  it("hogar: apaga todas las luces y automatización", async () => {
    const { ctx, engine } = await makeCtx();
    global.fetch = vi.fn(async () => new Response("{}")) as never;
    Object.defineProperty(globalThis, "navigator", { value: { onLine: false, userAgent: "" }, configurable: true });
    await engine.insert("smart_home_devices", { provider: "govee", external_id: "1", name: "Tira LED", room: "Salón", type: "light", state: { on: true }, online: true });
    const r = await routeUtterance("apaga todas las luces", ctx, effectiveShortcuts([]));
    expect(r?.reply).toContain("apagado");
    expect((await engine.list("smart_home_devices"))[0].state.on).toBe(false);
    const a = await routeUtterance("apaga todo a las 11pm", ctx, []);
    expect(a?.reply).toContain("23:00");
    expect((await engine.list("home_automations"))[0].cron).toBe("0 23 * * *");
  });

  it("navegación y atajos por defecto (español e inglés)", async () => {
    const { ctx } = await makeCtx();
    expect((await routeUtterance("abre mis notas", ctx, effectiveShortcuts([])))?.navigate).toBe("/memories?tab=notes");
    expect((await routeUtterance("open diary", ctx, effectiveShortcuts([])))?.navigate).toBe("/diary");
  });

  it("atajo personalizado y desactivar uno de serie", () => {
    const rows = [
      { id: "c1", user_id: U, trigger_phrase: "modo cine", action: "home_command", params: { command: "apaga todas las luces" }, is_default: false, enabled: true, created_at: "", updated_at: "" },
      { id: "o1", user_id: U, trigger_phrase: "", action: "", params: { defaultId: "default-music" }, is_default: true, enabled: false, created_at: "", updated_at: "" },
    ];
    const sc = effectiveShortcuts(rows as never);
    expect(matchShortcut("Hey Friday, modo cine", sc)?.action).toBe("home_command");
    expect(matchShortcut("pon mi música", sc)).toBeNull();
  });

  it("plan Free: solo 3 skills, el resto ofrece mejorar", async () => {
    const { ctx, engine } = await makeCtx("free");
    const r = await routeUtterance("apaga todas las luces", ctx, []);
    expect(r?.reply).toMatch(/Pro/);
    expect(await engine.list("home_automations")).toHaveLength(0);
    expect((await routeUtterance("apunta que pan", ctx, []))?.reply).toBe("Apuntado, hermano.");
  });

  it("lo que no es una skill va al cerebro (null)", async () => {
    const { ctx } = await makeCtx();
    expect(await routeUtterance("¿qué opinas de mi idea de negocio?", ctx, effectiveShortcuts([]))).toBeNull();
  });
});
