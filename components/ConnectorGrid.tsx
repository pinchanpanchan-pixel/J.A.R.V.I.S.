"use client";
import { useMemo } from "react";
import { Info } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useTable } from "@/hooks/useTable";
import { useProfileActions } from "@/hooks/useProfileActions";
import type { ConnectorMeta } from "@/connectors/types";

const AUTH_LABEL: Record<ConnectorMeta["auth"], string> = {
  oauth: "Inicio de sesión",
  ios_shortcut: "Atajos de iOS",
  import: "Importación",
  api_key: "Clave de la app",
  native_only: "App nativa",
};

/** Rejilla de conectores con interruptor (apps o hogar). */
export function ConnectorGrid({
  connectors,
  onSkip,
  locked = false,
  maxEnabled = null,
}: {
  connectors: ConnectorMeta[];
  onSkip?: () => void;
  locked?: boolean;
  maxEnabled?: number | null;
}) {
  const { rows } = useTable("connectors_tokens");
  const { setConnector } = useProfileActions();
  const enabled = useMemo(() => new Set(rows.filter((r) => r.enabled).map((r) => r.provider)), [rows]);
  const selectable = connectors.filter((c) => c.auth !== "native_only");
  const allOn = selectable.every((c) => enabled.has(c.id));
  const enabledCount = connectors.filter((c) => enabled.has(c.id)).length;

  const toggle = (c: ConnectorMeta, on: boolean) => {
    if (on && maxEnabled !== null && enabledCount >= maxEnabled) return;
    void setConnector(c, on);
  };

  const selectAll = () => {
    const target = !allOn;
    let count = enabledCount;
    for (const c of selectable) {
      if (target && !enabled.has(c.id)) {
        if (maxEnabled !== null && count >= maxEnabled) break;
        count++;
        void setConnector(c, true);
      } else if (!target && enabled.has(c.id)) {
        void setConnector(c, false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button type="button" disabled={locked} onClick={selectAll} className="jv-btn-ghost flex-1 py-2.5 text-sm">
          {allOn ? "Quitar todo" : "Seleccionar todo"}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="jv-btn-ghost flex-1 py-2.5 text-sm text-white/70">
            Saltar
          </button>
        )}
      </div>
      {maxEnabled !== null && (
        <p className="text-center text-[11px] text-white/45">
          Tu plan permite {maxEnabled} {maxEnabled === 1 ? "conexión" : "conexiones"} ({enabledCount}/{maxEnabled}).
        </p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {connectors.map((c) => {
          const on = enabled.has(c.id);
          const disabled = locked || c.auth === "native_only";
          return (
            <div
              key={c.id}
              onClick={() => !disabled && toggle(c, !on)}
              className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl border p-3 transition ${
                on ? "border-arc/40 bg-arc/[0.08]" : "border-white/10 bg-white/[0.04]"
              } ${disabled ? "cursor-default opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <BrandLogo meta={c} size={36} />
                <Toggle checked={on} disabled={disabled} onChange={(v) => toggle(c, v)} label={c.name} />
              </div>
              <div>
                <div className="text-[13px] font-semibold leading-tight">{c.name}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-white/45">{AUTH_LABEL[c.auth]}</div>
              </div>
              {c.note && (
                <div className="flex gap-1 text-[10.5px] leading-snug text-white/40">
                  <Info className="mt-px h-3 w-3 shrink-0" />
                  {c.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
