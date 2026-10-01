import { describe, it, expect, vi } from "vitest";
import config from "@/config/shortcuts.json";
import { SyncEngine } from "@/lib/sync/engine";
import { memoryKVFactory } from "@/lib/sync/kv";
import { MockRemote } from "@/lib/sync/mockRemote";
import { featuresFor } from "@/lib/plans";
import { routeUtterance } from "@/skills";
import { connectedSet, effectiveShortcuts, matchShortcut, shortcutGroups } from "@/lib/shortcuts";
import type { SkillContext } from "@/skills/types";
import type { ConnectorTokenRow, ShortcutRow } from "@/types/db";

const U = "33333333-3333-4333-8333-333333333333";
const ALL = new Set(["home", "spotify"]);

async function ctx() {
  const engine = new SyncEngine({ kvFactory: memoryKVFactory(), remote: new MockRemote(memoryKVFactory()) });
  await engine.start(U);
  const c: SkillContext = {
    engine,
    userId: U,
    userName: "Pancho",
    assistantName: "Friday",
    timezone: "Europe/Madrid",
    features: featuresFor("pro"),
    navigate: vi.fn(),
    openQuickNote: vi.fn(),
    askBrain: vi.fn(async () => "ok"),
    connector: vi.fn(async () => ({ events: [], sample: true, ok: true })) as never,
    now: () => new Date(),
  };
  return c;
}

/** Lo que debe pasar con cada acción de serie. */
const EXPECT: Record<string, (r: { reply: string; navigate?: string } | null, c: SkillContext) => void> = {
  open_quick_notes: (r) => expect(r?.navigate).toBe("/memories?tab=notes"),
  open_memories: (r) => expect(r?.navigate).toBe("/memories"),
  create_quick_note: (_r, c) => expect(c.openQuickNote).toHaveBeenCalled(),
  open_diary: (r) => expect(r?.navigate).toBe("/diary"),
  recap_yesterday: (r) => expect(r?.reply).toBeTruthy(),
  summarize_day: (r) => expect(r?.reply).toBeTruthy(),
  lights_off: (r) => expect(r?.reply).toBeTruthy(),
  play_music: (r) => expect(r?.reply).toBeTruthy(),
};

describe("atajos de voz de serie", () => {
  for (const g of config.defaults) {
    for (const phrase of [...g.phrases.es, ...g.phrases.en]) {
      it(`«${phrase}» → ${g.action}`, async () => {
        const c = await ctx();
        const list = effectiveShortcuts([], ALL);
        expect(matchShortcut(`Oye Friday, ${phrase}`, list, "Friday")?.action).toBe(g.action);
        const r = await routeUtterance(phrase, c, list);
        EXPECT[g.action](r, c);
      });
    }
  }

  it("una fila por acción con español e inglés juntos", () => {
    const groups = shortcutGroups([], ALL);
    expect(groups.filter((g) => g.isDefault)).toHaveLength(config.defaults.length);
    expect(groups.find((g) => g.action === "open_quick_notes")?.phrases.en).toContain("open notes block");
  });

  it("luces y música vienen apagadas hasta tener la conexión", () => {
    const off = shortcutGroups([], new Set());
    expect(off.find((g) => g.action === "lights_off")).toMatchObject({ enabled: false, available: false });
    expect(off.find((g) => g.action === "play_music")).toMatchObject({ enabled: false, available: false });
    const tokens = [{ provider: "hue", kind: "home", enabled: true, status: "connected" }] as ConnectorTokenRow[];
    expect(shortcutGroups([], connectedSet(tokens)).find((g) => g.action === "lights_off")?.enabled).toBe(true);
  });

  it("apagar un atajo de serie apaga todas sus frases; los propios tienen prioridad", () => {
    const rows = [
      { id: "x", is_default: true, enabled: false, params: { defaultId: "default-open-diary" }, trigger_phrase: "", action: "" },
      { id: "c1", is_default: false, enabled: true, params: { path: "/home" }, trigger_phrase: "abre el diario", action: "navigate" },
    ] as unknown as ShortcutRow[];
    const list = effectiveShortcuts(rows, ALL);
    expect(matchShortcut("open diary", list)).toBeNull();
    expect(matchShortcut("abre el diario", list)?.action).toBe("navigate");
  });
});
