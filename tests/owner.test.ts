import { describe, it, expect } from "vitest";
import { isOwner, parseOwnerEmails } from "@/lib/owner";
import { stableId } from "@/lib/ids";

describe("owner", () => {
  const ownerEmails = parseOwnerEmails(" pinchan.panchan@gmail.com , otro@x.com");
  it("detecta email propietario sin importar mayúsculas", () => {
    expect(isOwner({ email: "Pinchan.Panchan@gmail.com", ownerEmails, ownerCode: "PANCHAN100", redeemedCodes: [] })).toBe(true);
  });
  it("detecta código PANCHAN100 canjeado", () => {
    expect(isOwner({ email: "x@y.com", ownerEmails, ownerCode: "PANCHAN100", redeemedCodes: ["panchan100"] })).toBe(true);
  });
  it("usuario normal no es propietario", () => {
    expect(isOwner({ email: "x@y.com", ownerEmails, ownerCode: "PANCHAN100", redeemedCodes: ["BROTHER50"] })).toBe(false);
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
