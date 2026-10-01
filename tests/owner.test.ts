import { describe, it, expect } from "vitest";
import { isOwner, parseOwnerEmails } from "@/lib/owner";
import { stableId } from "@/lib/ids";

describe("owner", () => {
  const ownerEmails = parseOwnerEmails(" otro@x.com ");
  it("los dos propietarios están siempre (sin importar mayúsculas) y OWNER_EMAILS añade más", () => {
    expect(isOwner({ email: "Pinchan.Panchan@gmail.com", ownerEmails })).toBe(true);
    expect(isOwner({ email: "mateolabandayt@gmail.com ", ownerEmails })).toBe(true);
    expect(isOwner({ email: "otro@x.com", ownerEmails })).toBe(true);
  });
  it("canjear un código ya no convierte en propietario", () => {
    expect(isOwner({ email: "x@y.com", ownerEmails })).toBe(false);
  });
});

describe("stableId", () => {
  it("es determinista y con formato UUID", () => {
    const a = stableId("u1", "spotify");
    expect(a).toBe(stableId("u1", "spotify"));
    expect(a).not.toBe(stableId("u1", "notion"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
