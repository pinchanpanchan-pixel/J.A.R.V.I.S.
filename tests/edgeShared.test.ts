import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { generate } from "../scripts/sync_edge_shared.mjs";

describe("código compartido con las Edge Functions", () => {
  it("está sincronizado (ejecuta: node scripts/sync_edge_shared.mjs)", () => {
    const files = generate() as unknown as Record<string, string>;
    for (const [name, content] of Object.entries(files)) {
      const onDisk = readFileSync(path.resolve("supabase/functions/_shared/core", name), "utf8");
      expect(onDisk, name).toBe(content);
    }
  });
});
