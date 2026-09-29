"use client";
import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { apiJson } from "@/lib/api";
import { publicEnv } from "@/lib/env";

/** Guía + token personal para conectar Notas, Recordatorios, Contactos y Calendario de Apple con Atajos. */
export function IosShortcuts() {
  const [token, setToken] = useState<string | null>(null);
  const [mock, setMock] = useState(false);
  const url = `${publicEnv.appUrl}/api/ios/ingest`;
  const generate = async () => {
    const r = await apiJson<{ token: string; mock: boolean }>("/api/ios/token", { method: "POST" });
    setToken(r.token);
    setMock(r.mock);
  };
  return (
    <div className="flex flex-col gap-3 text-sm text-white/80">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-white/70">
        <li>Genera tu token personal (guárdalo: solo se muestra una vez).</li>
        <li>En la app Atajos crea un atajo: «Obtener notas / recordatorios / contactos / eventos».</li>
        <li>
          Añade «Obtener contenido de URL» → método POST a <code className="selectable break-all text-arc">{url}</code>
        </li>
        <li>
          Cabecera <code>Authorization: Bearer TU_TOKEN</code> y cuerpo JSON <code>{`{"type":"note","items":[{"title":…,"content":…,"date":…}]}`}</code>
        </li>
        <li>Automatízalo (p. ej. cada noche) desde la pestaña Automatización de Atajos.</li>
      </ol>
      <button onClick={() => void generate()} className="jv-btn-ghost">
        <KeyRound className="h-4 w-4" /> Generar token personal
      </button>
      {token && (
        <div className="flex items-center gap-2 rounded-2xl bg-black/30 p-3">
          <code className="selectable flex-1 break-all text-xs">{token}</code>
          <button onClick={() => void navigator.clipboard?.writeText(token)} aria-label="Copiar token" className="p-1 text-white/60">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      )}
      {mock && <p className="text-[11px] text-amber-200/80">Modo simulado: el puente funciona cuando configures Supabase.</p>}
    </div>
  );
}
