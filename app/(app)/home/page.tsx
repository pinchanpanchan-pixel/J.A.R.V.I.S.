"use client";
import { useState } from "react";
import { Lightbulb, Loader2, Lock, Power, RefreshCw, Sparkles } from "lucide-react";
import { ConnectorGrid } from "@/components/ConnectorGrid";
import { HOME_COMPATIBLE, HOME_CONNECTORS, connectorName } from "@/connectors/registry";
import { apiJson } from "@/lib/api";
import { HomeDevices } from "@/components/HomeDevices";
import { useTable } from "@/hooks/useTable";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/components/providers/SyncProvider";
import { MOCK_DEVICES } from "@/connectors/home/mockDevices";
import { stableId } from "@/lib/ids";
import { isMockMode } from "@/lib/env";
import { setDeviceState } from "@/services/homeClient";
import type { DeviceState, SmartHomeDeviceRow } from "@/types/db";

export default function HomeTab() {
  const { features, user } = useProfile();
  const { engine } = useSync();
  const { rows: devices } = useTable("smart_home_devices");
  const { rows: connectors } = useTable("connectors_tokens");
  const homeConnected = connectors.filter((c) => c.kind === "home" && c.enabled && (c.status === "connected" || (isMockMode && c.status === "mock")));
  const [syncing, setSyncing] = useState(false);
  const refresh = async () => {
    setSyncing(true);
    await apiJson("/api/home/sync", { method: "POST" }).catch(() => null);
    setSyncing(false);
  };

  const change = async (d: SmartHomeDeviceRow, patch: DeviceState) => {
    if (engine) await setDeviceState(engine, d, patch);
  };

  const allOff = async () => {
    if (!engine) return;
    // Lista actual del motor (no la del último render): no se salta dispositivos recién añadidos.
    for (const d of await engine.list("smart_home_devices")) {
      if (d.state.on && d.type !== "sensor") await change(d, { on: false });
    }
  };

  const addDemo = async () => {
    if (!engine || !user) return;
    const providers = new Set(homeConnected.map((c) => c.provider));
    const list = MOCK_DEVICES.filter((d) => providers.size === 0 || providers.has(d.provider));
    for (const d of list.length ? list : MOCK_DEVICES) {
      await engine.upsert("smart_home_devices", stableId(user.id, d.provider, d.external_id), { ...d, online: true });
    }
  };

  if (!features.smartHome) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="h-8 w-8 text-gold" />
        <h1 className="text-xl font-semibold">Tu hogar, a tu voz</h1>
        <p className="text-sm text-white/60">«Apaga todas las luces», «pon luz roja al 50 %», «enciende el aire». Disponible en Pro Lite y Pro.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Hogar</h1>
        {devices.length > 0 && (
          <button onClick={() => void allOff()} className="jv-btn-ghost px-4 py-2 text-sm">
            <Power className="h-4 w-4" /> Apagar todo
          </button>
        )}
      </header>
      {homeConnected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span>Conectado:</span>
          {homeConnected.map((c) => (
            <span key={c.id} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/75">
              {connectorName(c.provider)}
            </span>
          ))}
          {!isMockMode && (
            <button onClick={() => void refresh()} disabled={syncing} className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-white/60 hover:bg-white/10" aria-label="Actualizar dispositivos">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Actualizar
            </button>
          )}
        </div>
      )}
      {devices.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="jv-card flex flex-col items-center gap-3 p-7 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-arc/10 text-arc">
              <Lightbulb className="h-6 w-6" />
            </div>
            <p className="text-[15px] font-medium">{homeConnected.length ? "Conectado, pero aún no veo dispositivos" : "Conecta tu casa y manéjala con la voz"}</p>
            <p className="text-sm leading-relaxed text-white/55">
              «Apaga todas las luces», «pon el salón en rojo al 50 %», «enciende la cafetera», «apágalo todo a las 11». También puedes crear rutinas y yo las ejecuto a su hora.
            </p>
            <p className="text-xs text-white/40">Compatible con: {HOME_COMPATIBLE.join(", ")}.</p>
            {isMockMode && (
              <button onClick={() => void addDemo()} className="jv-btn-ghost text-sm">
                <Sparkles className="h-4 w-4" /> Añadir dispositivos de demostración
              </button>
            )}
          </div>
          <ConnectorGrid connectors={HOME_CONNECTORS} returnTo="/home" />
        </div>
      ) : (
        <HomeDevices devices={devices} onChange={(d, p) => void change(d, p)} />
      )}
    </div>
  );
}
