"use client";
import { useEffect } from "react";
import { useSync } from "./SyncProvider";
import { cronMatches, minuteKey } from "@/lib/cron";
import { runHomeCommand } from "@/services/homeClient";

/**
 * Ejecuta las automatizaciones del hogar mientras la app está abierta (y en modo simulado).
 * Con la app cerrada lo hace la Edge Function `home-automations` (cron cada minuto).
 * last_run_at (sincronizado) evita que dos dispositivos o el servidor la repitan.
 */
export function AutomationRunner() {
  const { engine, ready } = useSync();
  useEffect(() => {
    if (!engine || !ready) return;
    const tick = async () => {
      const now = new Date();
      for (const a of await engine.list("home_automations")) {
        if (!a.enabled || !cronMatches(a.cron, now, a.timezone)) continue;
        const key = minuteKey(now, a.timezone);
        if (a.last_run_at && minuteKey(new Date(a.last_run_at), a.timezone) === key) continue;
        await engine.update("home_automations", a.id, { last_run_at: now.toISOString() });
        await runHomeCommand(engine, a.command, a.timezone);
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 20_000);
    return () => clearInterval(t);
  }, [engine, ready]);
  return null;
}
