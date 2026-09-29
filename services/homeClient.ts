"use client";
import type { SyncEngine } from "@/lib/sync/engine";
import { apiFetch } from "@/lib/api";
import type { DeviceState, SmartHomeDeviceRow } from "@/types/db";
import { applyPatch, parseHomeCommand, selectDevices } from "./homeController";

/** Cambia el estado de un dispositivo: estado sincronizado al instante + orden al fabricante. */
export async function setDeviceState(engine: SyncEngine, device: SmartHomeDeviceRow, patch: DeviceState): Promise<void> {
  const next = applyPatch(device, patch);
  await engine.update("smart_home_devices", device.id, { state: next });
  if (!navigator.onLine) return; // el estado ya está en cola; el dispositivo físico, al volver
  try {
    const res = await apiFetch("/api/home/command", {
      method: "POST",
      body: JSON.stringify({ provider: device.provider, external_id: device.external_id, meta: (device.state.meta as Record<string, unknown>) ?? undefined, patch: next }),
    });
    const j = (await res.json().catch(() => ({}))) as { openUrl?: string };
    if (j.openUrl && /iPhone|iPad|Macintosh/.test(navigator.userAgent)) window.location.href = j.openUrl;
  } catch {
    /* el estado local queda aplicado; se reintenta en la próxima orden */
  }
}

export interface HomeRunResult {
  handled: boolean;
  reply: string;
}

/** Ejecuta una orden de hogar en lenguaje natural. */
export async function runHomeCommand(engine: SyncEngine, text: string, timezone: string): Promise<HomeRunResult> {
  const devices = await engine.list("smart_home_devices");
  const rooms = Array.from(new Set(devices.map((d) => d.room).filter(Boolean))) as string[];
  const intent = parseHomeCommand(text, rooms, devices.map((d) => d.name));
  if (intent.kind === "unknown") return { handled: false, reply: "" };

  if (intent.kind === "automation") {
    await engine.insert("home_automations", {
      name: intent.command,
      cron: intent.cron!,
      timezone,
      command: intent.command,
      enabled: true,
      last_run_at: null,
    });
    return { handled: true, reply: `Hecho. Todos los días a las ${intent.when} me encargo: «${intent.command}». Si era solo para hoy, dímelo.` };
  }

  const targets = selectDevices(devices, intent.target).filter((d) => d.online);
  if (targets.length === 0) {
    return { handled: true, reply: devices.length ? "No encuentro ese dispositivo, hermano. Revisa la pestaña Hogar." : "Aún no tienes el hogar conectado, hermano. Hazlo en Ajustes → Hogar." };
  }
  await Promise.all(targets.map((d) => setDeviceState(engine, d, intent.patch)));
  const names = targets.length <= 2 ? targets.map((d) => d.name.toLowerCase()).join(" y ") : `${targets.length} dispositivos`;
  const verb =
    intent.patch.on === false ? "apagado" : intent.patch.temperature ? `a ${intent.patch.temperature} grados` : intent.patch.color || intent.patch.brightness ? "ajustado" : "encendido";
  return { handled: true, reply: `Hecho, hermano: ${names}, ${verb}.` };
}
