"use client";
import Link from "next/link";
import { Lock, Power, Sparkles } from "lucide-react";
import { HomeDevices } from "@/components/HomeDevices";
import { useTable } from "@/hooks/useTable";
import { useProfile } from "@/hooks/useProfile";
import { useSync } from "@/components/providers/SyncProvider";
import { MOCK_DEVICES } from "@/connectors/home/mockDevices";
import { stableId } from "@/lib/ids";
import { isMockMode } from "@/lib/env";
import type { DeviceState, SmartHomeDeviceRow } from "@/types/db";

export default function HomeTab() {
  const { features, user } = useProfile();
  const { engine } = useSync();
  const { rows: devices } = useTable("smart_home_devices");
  const { rows: connectors } = useTable("connectors_tokens");
  const homeConnected = connectors.filter((c) => c.kind === "home" && c.enabled);

  const change = async (d: SmartHomeDeviceRow, patch: DeviceState) => {
    await engine?.update("smart_home_devices", d.id, { state: { ...d.state, ...patch } });
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
      {devices.length === 0 ? (
        <div className="jv-card flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-white/60">
            {homeConnected.length ? `Conectado: ${homeConnected.map((c) => c.provider).join(", ")}. Aún no hay dispositivos.` : "Aún no has conectado tu hogar."}
          </p>
          <Link href="/settings#hogar" className="jv-btn-primary">
            Conectar hogar
          </Link>
          {isMockMode && (
            <button onClick={() => void addDemo()} className="jv-btn-ghost text-sm">
              <Sparkles className="h-4 w-4" /> Añadir dispositivos de demostración
            </button>
          )}
        </div>
      ) : (
        <HomeDevices devices={devices} onChange={(d, p) => void change(d, p)} />
      )}
    </div>
  );
}
