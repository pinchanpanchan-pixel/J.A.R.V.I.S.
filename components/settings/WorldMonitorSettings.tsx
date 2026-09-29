"use client";
import { Play, Siren } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { Row } from "./Section";
import { useProfile } from "@/hooks/useProfile";
import { useRow } from "@/hooks/useTable";
import { useSync } from "@/components/providers/SyncProvider";
import { ALERT_SOUNDS, playAlert } from "@/services/audio/sounds";
import { saveAlerts } from "@/services/worldMonitorClient";
import type { WorldMonitorSettingsRow } from "@/types/db";

/** Ajustes de WorldMonitor (sincronizados). */
export function WorldMonitorSettings({ locked }: { locked: boolean }) {
  const { user, userName } = useProfile();
  const { engine } = useSync();
  const s = useRow("world_monitor_settings", user?.id);
  if (!s || !user) return null;
  const set = (patch: Partial<WorldMonitorSettingsRow>) => void engine?.upsert("world_monitor_settings", user.id, patch);

  const testAlert = async () => {
    if (!engine) return;
    await saveAlerts(engine, user.id, [
      {
        kind: "earthquake",
        severity: "warning",
        external_id: `prueba-${Date.now()}`,
        title: "Sismo de magnitud 5,1 (prueba)",
        body: `Ey ${userName}, hay un sismo de magnitud 5,1 a 120 km de ti, ¿estás bien?`,
        data: { mag: 5.1, km: 120, place: "Simulacro", test: true },
      },
    ]);
  };

  return (
    <div className={locked ? "pointer-events-none opacity-50" : undefined}>
      <Row label="Sismos" hint="Servicio Geológico de EE. UU. (USGS), cada pocos minutos">
        <Toggle checked={s.quake_enabled} onChange={(v) => set({ quake_enabled: v })} label="Sismos" />
      </Row>
      <div className="flex flex-col gap-4 py-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs text-white/55">
            <span>Magnitud mínima</span>
            <b className="text-white">{Number(s.min_magnitude).toFixed(1)}</b>
          </span>
          <input type="range" min={3} max={8} step={0.1} value={s.min_magnitude} onChange={(e) => set({ min_magnitude: Number(e.target.value) })} className="accent-arc" aria-label="Magnitud mínima" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs text-white/55">
            <span>Radio desde tu ubicación</span>
            <b className="text-white">{s.radius_km} km</b>
          </span>
          <input type="range" min={50} max={2000} step={50} value={s.radius_km} onChange={(e) => set({ radius_km: Number(e.target.value) })} className="accent-arc" aria-label="Radio en kilómetros" />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-white/80">Comprobar cada</span>
          <select className="jv-input w-32 py-2" value={s.check_interval_minutes} onChange={(e) => set({ check_interval_minutes: Number(e.target.value) })} aria-label="Intervalo">
            {[2, 5, 10, 15].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-white/80">Sonido de alerta</span>
          <div className="flex items-center gap-2">
            <select className="jv-input w-36 py-2" value={s.alert_sound} onChange={(e) => set({ alert_sound: e.target.value })} aria-label="Sonido de alerta">
              {ALERT_SOUNDS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <button
              onClick={async () => {
                const stop = await playAlert(s.alert_sound);
                setTimeout(stop, 2500);
              }}
              className="rounded-full bg-white/10 p-2.5"
              aria-label="Escuchar sonido"
            >
              <Play className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <Row label="Clima severo" hint="Avisos oficiales y condiciones extremas (OpenWeather)">
        <Toggle checked={s.weather_enabled} onChange={(v) => set({ weather_enabled: v })} label="Clima severo" />
      </Row>
      <Row label="Calidad del aire" hint={`Avisar desde nivel ${s.aqi_threshold} de 5`}>
        <Toggle checked={s.air_quality_enabled} onChange={(v) => set({ air_quality_enabled: v })} label="Calidad del aire" />
      </Row>
      {s.air_quality_enabled && (
        <input type="range" min={2} max={5} step={1} value={s.aqi_threshold} onChange={(e) => set({ aqi_threshold: Number(e.target.value) })} className="w-full accent-arc" aria-label="Umbral de calidad del aire" />
      )}
      <button onClick={() => void testAlert()} className="jv-btn-ghost mt-3 w-full text-sm">
        <Siren className="h-4 w-4" /> Probar alerta
      </button>
      {s.last_checked_at && <p className="mt-2 text-center text-[11px] text-white/35">Última comprobación: {new Date(s.last_checked_at).toLocaleTimeString("es-ES")}</p>}
    </div>
  );
}
