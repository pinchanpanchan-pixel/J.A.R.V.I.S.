import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?)$/.test(f) ? [p] : [];
  });
}

describe("efectos de React", () => {
  it("ningún useEffect devuelve una expresión (debe ser un bloque o una función de limpieza)", () => {
    const bad: string[] = [];
    for (const f of ["app", "components", "hooks"].flatMap(files)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/use(Layout)?Effect\(\s*(async\s*)?\(\)\s*=>(?!\s*\{)(?!\s*\(\)\s*=>)/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim()}`);
          if (/use(Layout)?Effect\(\s*async/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(bad).toEqual([]);
  });
});
