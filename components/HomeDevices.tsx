"use client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { AirVent, Lightbulb, Minus, Plug, Plus, Speaker, ToggleRight, Tv, Thermometer } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import type { DeviceState, DeviceType, SmartHomeDeviceRow } from "@/types/db";

const ICONS: Record<DeviceType, typeof Lightbulb> = {
  light: Lightbulb,
  plug: Plug,
  ac: AirVent,
  switch: ToggleRight,
  sensor: Thermometer,
  speaker: Speaker,
  tv: Tv,
};

export const LIGHT_COLORS = ["#FFE8C2", "#FFFFFF", "#64FFDA", "#38BDF8", "#A78BFA", "#FF3B30", "#F5C451", "#34D399"];

function DeviceTile({ d, onChange }: { d: SmartHomeDeviceRow; onChange: (patch: DeviceState) => void }) {
  const Icon = ICONS[d.type] ?? Lightbulb;
  const on = !!d.state.on;
  const glow = d.type === "light" && on ? (d.state.color as string) ?? "#FFE8C2" : null;
  return (
    <motion.div
      layout
      className={`flex flex-col gap-3 rounded-3xl border p-4 transition ${on ? "border-white/15 bg-white/[0.09]" : "border-white/[0.07] bg-white/[0.03]"} ${!d.online ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl transition"
          style={{ background: glow ? `${glow}33` : "rgba(255,255,255,0.06)", color: glow ?? (on ? "#64FFDA" : "rgba(255,255,255,.5)"), boxShadow: glow ? `0 0 24px ${glow}55` : undefined }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <Toggle checked={on} disabled={!d.online} onChange={(v) => onChange({ on: v })} label={d.name} />
      </div>
      <div>
        <div className="text-[14px] font-semibold leading-tight">{d.name}</div>
        <div className="text-[11px] text-white/40">{d.online ? (on ? "Encendido" : "Apagado") : "Sin conexión"}</div>
      </div>
      {d.type === "light" && on && (
        <>
          <input
            type="range"
            min={1}
            max={100}
            value={(d.state.brightness as number) ?? 100}
            onChange={(e) => onChange({ brightness: Number(e.target.value) })}
            className="w-full accent-arc"
            aria-label={`Brillo de ${d.name}`}
          />
          <div className="flex flex-wrap gap-1.5">
            {LIGHT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                aria-label={`Color ${c}`}
                className={`h-5 w-5 rounded-full border ${d.state.color === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </>
      )}
      {d.type === "ac" && (
        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-2 py-1">
          <button onClick={() => onChange({ temperature: Math.max(16, ((d.state.temperature as number) ?? 23) - 1) })} className="p-1.5" aria-label="Bajar temperatura">
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{(d.state.temperature as number) ?? 23}°</span>
          <button onClick={() => onChange({ temperature: Math.min(30, ((d.state.temperature as number) ?? 23) + 1) })} className="p-1.5" aria-label="Subir temperatura">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

/** Dispositivos agrupados por habitación. */
export function HomeDevices({ devices, onChange }: { devices: SmartHomeDeviceRow[]; onChange: (d: SmartHomeDeviceRow, patch: DeviceState) => void }) {
  const rooms = useMemo(() => {
    const m = new Map<string, SmartHomeDeviceRow[]>();
    [...devices].sort((a, b) => a.name.localeCompare(b.name)).forEach((d) => {
      const r = d.room || "Otros";
      m.set(r, [...(m.get(r) ?? []), d]);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [devices]);

  return (
    <div className="flex flex-col gap-6">
      {rooms.map(([room, list]) => (
        <section key={room}>
          <h2 className="mb-2 text-[13px] font-semibold text-white/55">
            {room} · {list.filter((d) => d.state.on).length}/{list.length} encendidos
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {list.map((d) => (
              <DeviceTile key={d.id} d={d} onChange={(p) => onChange(d, p)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
