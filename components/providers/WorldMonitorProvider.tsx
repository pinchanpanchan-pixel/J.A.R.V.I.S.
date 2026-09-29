"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CloudLightning, HeartHandshake, Phone, Wind } from "lucide-react";
import { useSync } from "./SyncProvider";
import { useVoice } from "./VoiceProvider";
import { useProfile } from "@/hooks/useProfile";
import { useRow, useTable } from "@/hooks/useTable";
import { stableId } from "@/lib/ids";
import { checkWorld } from "@/services/worldMonitorClient";
import { SAFETY_TIPS } from "@/services/worldMonitorService";
import { playAlert } from "@/services/audio/sounds";
import { Sheet } from "@/components/ui/Sheet";
import type { WorldAlertRow } from "@/types/db";

const ICON = { earthquake: AlertTriangle, weather: CloudLightning, air_quality: Wind };
const FRESH_MS = 60 * 60 * 1000; // solo se interrumpe por alertas de la última hora

/**
 * Vigilancia mientras la app está abierta (cada check_interval_minutes) + alerta a pantalla
 * completa. Con la app cerrada, la Edge Function `world-monitor` crea la alerta y manda push;
 * al abrir, esta alerta (sincronizada) se muestra igual en todos los dispositivos.
 */
export function WorldMonitorProvider() {
  const { engine, ready } = useSync();
  const { user, features, userName, profile } = useProfile();
  const onboarded = !!profile?.onboarding_completed;
  const voice = useVoice();
  const settings = useRow("world_monitor_settings", user?.id);
  const location = useRow("user_locations", user ? stableId(user.id, "primary-location") : null);
  const { rows: alerts } = useTable("world_alerts", { sort: (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) });
  const [tipsFor, setTipsFor] = useState<WorldAlertRow | null>(null);
  const announced = useRef(new Set<string>());
  const stopSound = useRef<(() => void) | null>(null);
  const lastWeather = useRef(0);
  // Alerta cuyo anuncio por voz sigue pendiente (se cancela si el usuario responde antes)
  const pendingAnnounce = useRef<string | null>(null);

  // Bucle de vigilancia
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    // Empieza a vigilar al terminar el onboarding (no interrumpe la configuración inicial)
    if (!engine || !ready || !user || !features.worldMonitor || !location || !onboarded) return;
    let cancelled = false;
    const run = async () => {
      const s = settingsRef.current;
      if (!s || cancelled || document.visibilityState !== "visible" || !navigator.onLine) return;
      const weather = Date.now() - lastWeather.current > 30 * 60 * 1000;
      if (weather) lastWeather.current = Date.now();
      await checkWorld(engine, user.id, userName, s, location, { weather }).catch(() => undefined);
    };
    void run();
    const minutes = Math.max(1, settings?.check_interval_minutes ?? 2);
    const t = setInterval(() => void run(), minutes * 60_000);
    const onVisible = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [engine, ready, user, userName, features.worldMonitor, location, settings?.check_interval_minutes, onboarded]);

  const active = !onboarded ? null : alerts.find((a) => !a.acknowledged && Date.now() - Date.parse(a.created_at) < FRESH_MS) ?? null;

  // Anuncio: sonido fuerte + voz (J.A.R.V.I.S. interrumpe lo que estés haciendo)
  useEffect(() => {
    if (!active || announced.current.has(active.id)) return;
    announced.current.add(active.id);
    pendingAnnounce.current = active.id;
    const sound = settings?.alert_sound ?? "siren";
    void (async () => {
      stopSound.current?.();
      stopSound.current = await playAlert(sound, active.severity === "critical");
      if ("vibrate" in navigator) navigator.vibrate?.([400, 150, 400, 150, 800]);
      await new Promise((r) => setTimeout(r, 1600));
      if (pendingAnnounce.current !== active.id) return; // ya respondió «Estoy bien»
      if (active.severity !== "critical") stopSound.current?.();
      pendingAnnounce.current = null;
      await voice.interrupt(active.body);
    })();
  }, [active, settings?.alert_sound, voice]);

  const acknowledge = async (a: WorldAlertRow, needHelp = false) => {
    if (pendingAnnounce.current === a.id) pendingAnnounce.current = null;
    stopSound.current?.();
    stopSound.current = null;
    await engine?.update("world_alerts", a.id, { acknowledged: true, data: { ...a.data, response: needHelp ? "help" : "ok", responded_at: new Date().toISOString() } });
    if (needHelp) setTipsFor(a);
    else void voice.speak("Me alegro, hermano. Sigo vigilando.");
  };

  const Icon = active ? ICON[active.kind] : AlertTriangle;
  const data = (active?.data ?? {}) as { mag?: number; km?: number; place?: string; url?: string };

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.div
            key={active.id}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wm-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[#2a0606]/90 px-5 backdrop-blur-xl"
          >
            <motion.div
              className="absolute inset-0 -z-10"
              animate={{ opacity: [0.25, 0.6, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ background: "radial-gradient(circle at 50% 35%, rgba(255,59,48,.55), transparent 60%)" }}
            />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-[420px] rounded-[32px] border border-red-400/30 bg-[#1a0707]/95 p-7 text-center shadow-card">
              <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.9, repeat: Infinity }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-alert">
                <Icon className="h-8 w-8 text-white" />
              </motion.div>
              <h2 id="wm-title" className="text-2xl font-bold tracking-tight">
                {active.title}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-white/85">{active.body}</p>
              {active.kind === "earthquake" && (
                <p className="mt-2 text-xs text-white/50">
                  {data.place ?? ""} {data.km !== undefined ? `· ${data.km} km` : ""}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-2.5">
                <button onClick={() => void acknowledge(active)} className="jv-btn bg-white text-[#1a0707] hover:bg-white/90">
                  Estoy bien
                </button>
                <button onClick={() => void acknowledge(active, true)} className="jv-btn bg-alert text-white">
                  <HeartHandshake className="h-5 w-5" /> Necesito ayuda
                </button>
                <button onClick={() => setTipsFor(active)} className="text-sm text-white/60 underline-offset-4 hover:underline">
                  ¿Qué hago?
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Sheet open={!!tipsFor} onClose={() => setTipsFor(null)} title="Qué hacer ahora">
        {tipsFor && (
          <div className="flex flex-col gap-3">
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-white/85">
              {SAFETY_TIPS[tipsFor.kind].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <a href="tel:112" className="jv-btn bg-alert text-white">
              <Phone className="h-5 w-5" /> Llamar a emergencias (112)
            </a>
            <p className="text-center text-[11px] text-white/40">En EE. UU. y parte de América: 911.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
