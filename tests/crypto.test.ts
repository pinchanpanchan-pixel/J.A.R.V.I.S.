import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { open, seal } from "@/lib/crypto";

describe("crypto AES-256-GCM", () => {
  it("cifra y descifra", () => {
    const s = seal("mi secreto", "ai_key", "user-1");
    expect(s).not.toContain("mi secreto");
    expect(open(s, "ai_key", "user-1")).toBe("mi secreto");
  });
  it("no descifra para otro usuario ni otro propósito", () => {
    const s = seal("diario privado", "diary", "user-1");
    expect(() => open(s, "diary", "user-2")).toThrow();
    expect(() => open(s, "ai_key", "user-1")).toThrow();
  });
  it("detecta manipulación", () => {
    const s = seal("x", "diary", "u");
    const parts = s.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => open(parts.join("."), "diary", "u")).toThrow();
  });
});
