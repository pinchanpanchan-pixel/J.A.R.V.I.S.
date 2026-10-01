import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { apps } from "@/skills/apps";
import { normalizeText, type SkillContext } from "@/skills/types";
import { featuresFor } from "@/lib/plans";
import { authorizeUrl, fetchAccount, OAUTH, pkcePair } from "@/connectors/apps/oauth";
import { tuyaSign } from "@/connectors/home/tuya";
import { safeReturn } from "@/lib/safeReturn";
import { createHash } from "node:crypto";

const m = (s: string) => apps.match(normalizeText(s), s);

describe("skill de apps", () => {
  it("entiende cada tipo de petición", () => {
    expect(m("Añade una tarea: comprar regalo a mamá")).toMatchObject({ kind: "todo_add", text: "comprar regalo a mamá" });
    expect(m("¿Qué tareas tengo hoy?")).toMatchObject({ kind: "todo_list" });
    expect(m("¿Cómo fue mi último entreno?")).toMatchObject({ kind: "strava" });
    expect(m("¿Tengo algo en Outlook?")).toMatchObject({ kind: "outlook" });
    expect(m("Llévame a la Puerta del Sol")).toMatchObject({ kind: "maps", place: "la Puerta del Sol" });
    expect(m("Ponme lofi para estudiar en YouTube")).toMatchObject({ kind: "youtube", query: "lofi para estudiar" });
    expect(m("Busca el documento del presupuesto")).toMatchObject({ kind: "files", what: "documento", query: "presupuesto" });
    expect(m("cuéntame un chiste")).toBeNull();
  });

  it("Maps no necesita cuenta y abre la ruta", async () => {
    const ctx = { features: featuresFor("free") } as unknown as SkillContext;
    const r = await apps.execute(ctx, "Llévame a Atocha", { kind: "maps", place: "Atocha" });
    expect(r?.openUrl).toBe("https://www.google.com/maps/dir/?api=1&destination=Atocha");
  });

  it("sin la app conectada explica dónde conectarla", async () => {
    const connector = vi.fn(async () => ({ connected: false, tasks: [] }));
    const ctx = { features: featuresFor("pro"), connector } as unknown as SkillContext;
    expect((await apps.execute(ctx, "mis tareas", { kind: "todo_list" }))?.reply).toContain("conecta Todoist");
  });

  it("busca archivos en Sheets y OneDrive y abre el más reciente", async () => {
    const connector = vi.fn(async (p: string) => (p === "google_sheets" ? { connected: true, files: [{ name: "Gastos 2026", url: "https://docs.google.com/x", modified: null }] } : { connected: false, files: [] }));
    const ctx = { features: featuresFor("pro"), connector } as unknown as SkillContext;
    const r = await apps.execute(ctx, "busca la hoja de gastos", { kind: "files", what: "hoja", query: "gastos" });
    expect(connector).toHaveBeenCalledWith("google_sheets", { action: "search", query: "gastos" });
    expect(r).toMatchObject({ openUrl: "https://docs.google.com/x" });
  });
});

describe("OAuth de conectores", () => {
  it("Strava separa permisos con comas; Google pide identidad para «Conectado como»", () => {
    const strava = new URL(authorizeUrl("strava", { clientId: "c", redirectUri: "https://x/cb", state: "s" }));
    expect(strava.searchParams.get("scope")).toBe("read,activity:read_all");
    const g = new URL(authorizeUrl("gmail", { clientId: "c", redirectUri: "https://x/cb", state: "s" }));
    expect(g.searchParams.get("scope")).toContain("email");
    expect(g.searchParams.get("include_granted_scopes")).toBe("true");
    expect(Object.keys(OAUTH)).toEqual(expect.arrayContaining(["google_docs", "youtube", "outlook", "onedrive", "canva", "todoist", "strava", "hue"]));
  });

  it("Canva usa PKCE (S256)", () => {
    const { verifier, challenge } = pkcePair();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    const u = new URL(authorizeUrl("canva", { clientId: "c", redirectUri: "https://x/cb", state: "s", codeChallenge: challenge }));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("«Conectado como»: email de Google, nombre del atleta de Strava", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ email: "pancho@gmail.com" })));
    expect(await fetchAccount("google_calendar", { access_token: "t" }, f as never)).toBe("pancho@gmail.com");
    expect(await fetchAccount("strava", { access_token: "t", athlete: { firstname: "Pancho", lastname: "G" } })).toBe("Pancho G");
  });

  it("solo se vuelve a rutas internas", () => {
    expect(safeReturn("/")).toBe("/");
    expect(safeReturn("https://evil.com")).toBe("/settings?s=conexiones");
    expect(safeReturn("//evil.com")).toBe("/settings?s=conexiones");
  });

  it("firma de Tuya estable (HMAC-SHA256 en mayúsculas)", () => {
    const s = tuyaSign({ access_id: "id", access_secret: "secret" }, "", "1700000000000", "n", "GET", "/v1.0/token?grant_type=1");
    expect(s).toMatch(/^[0-9A-F]{64}$/);
    expect(s).toBe(tuyaSign({ access_id: "id", access_secret: "secret" }, "", "1700000000000", "n", "GET", "/v1.0/token?grant_type=1"));
  });
});
