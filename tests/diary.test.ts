import { describe, it, expect } from "vitest";
import { heuristicAnalysis } from "@/lib/diary/analysis";

describe("análisis heurístico del diario", () => {
  it("día bueno", () => {
    const a = heuristicAnalysis("Hoy ha sido un día genial. Terminé el proyecto del trabajo y comí con mamá. Me siento orgulloso.");
    expect(a.sentiment).toBeGreaterThan(0.3);
    expect(a.emotions).toEqual(expect.arrayContaining(["alegría", "orgullo"]));
    expect(a.tags).toEqual(expect.arrayContaining(["trabajo", "familia"]));
    expect(a.summary).toBe("Hoy ha sido un día genial.");
  });
  it("día malo", () => {
    const a = heuristicAnalysis("Estoy agotado y agobiado. Discutí con mi jefe y me siento fatal.");
    expect(a.sentiment).toBeLessThan(-0.3);
    expect(a.emotions).toEqual(expect.arrayContaining(["ansiedad"]));
  });
});
