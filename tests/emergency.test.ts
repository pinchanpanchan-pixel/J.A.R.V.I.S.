import { describe, it, expect } from "vitest";
import { emergencyNumber } from "@/lib/emergency";

describe("número de emergencias por país", () => {
  it("Europa 112, EE. UU. y México 911, y otros", () => {
    expect(emergencyNumber("España").number).toBe("112");
    expect(emergencyNumber("Estados Unidos").number).toBe("911");
    expect(emergencyNumber("United States").number).toBe("911");
    expect(emergencyNumber("MX").number).toBe("911");
    expect(emergencyNumber("Colombia").number).toBe("123");
    expect(emergencyNumber("Reino Unido").number).toBe("999");
    expect(emergencyNumber("Perú").number).toBe("105");
  });
  it("sin país usa la zona horaria; si nada, 112", () => {
    expect(emergencyNumber(null, "America/Los_Angeles").number).toBe("911");
    expect(emergencyNumber(null, "Europe/Madrid").number).toBe("112");
    expect(emergencyNumber(null).label).toBe("Llamar a emergencias (112)");
  });
});
