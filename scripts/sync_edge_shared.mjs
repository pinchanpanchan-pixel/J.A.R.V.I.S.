// Copia los módulos PUROS del proyecto a supabase/functions/_shared/core para las Edge Functions (Deno).
// Uso: node scripts/sync_edge_shared.mjs   (tests/edgeShared.test.ts comprueba que están al día)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "supabase/functions/_shared/core");
const FILES = {
  "lib/cron.ts": "cron.ts",
  "lib/geo.ts": "geo.ts",
  "lib/ids.ts": "ids.ts",
  "services/homeController.ts": "homeController.ts",
  "services/worldMonitorService.ts": "worldMonitorService.ts",
};
const IMPORT_MAP = {
  "@/lib/geo": "./geo.ts",
  "@/lib/ids": "./ids.ts",
  "@/lib/cron": "./cron.ts",
  "@/types/db": "./types.ts",
};

export function transform(src) {
  return (
    "// GENERADO por scripts/sync_edge_shared.mjs — no editar a mano.\n" +
    src.replace(/from "(@\/[^"]+)"/g, (m, spec) => {
      if (!IMPORT_MAP[spec]) throw new Error(`import no soportado en edge: ${spec}`);
      return `from "${IMPORT_MAP[spec]}"`;
    })
  );
}

export function generate() {
  const files = {};
  for (const [src, dst] of Object.entries(FILES)) files[dst] = transform(readFileSync(path.join(root, src), "utf8"));
  // Tipos: copia íntegra de types/db.ts
  files["types.ts"] = "// GENERADO por scripts/sync_edge_shared.mjs — no editar a mano.\n" + readFileSync(path.join(root, "types/db.ts"), "utf8");
  return files;
}

if (process.argv[1] && process.argv[1].endsWith("sync_edge_shared.mjs")) {
  mkdirSync(out, { recursive: true });
  for (const [name, content] of Object.entries(generate())) writeFileSync(path.join(out, name), content);
  console.log("edge shared core actualizado");
}
