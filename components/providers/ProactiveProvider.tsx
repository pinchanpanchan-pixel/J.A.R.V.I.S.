"use client";
import { useCallback, useEffect, useRef } from "react";
import { useSync } from "./SyncProvider";
import { useVoice } from "./VoiceProvider";
import { useProfile } from "@/hooks/useProfile";
import { useBrain } from "@/hooks/useBrain";
import { useRow, useTable } from "@/hooks/useTable";
import { stableId } from "@/lib/ids";
import { localDate } from "@/lib/dates";
import { whenAudioUnlocked } from "@/services/audio/context";
import { briefFallback, factsForBrain, fetchForecast } from "@/services/weather";

type Slot = "morning" | "afternoon" | "night";
// Mismas franjas que el saludo de la pantalla principal (antes de las 6 sigue siendo de noche).
export const slotFor = (h: number): Slot => (h >= 6 && h < 13 ? "morning" : h >= 13 && h < 21 ? "afternoon" : "night");

const BRAIN_DOWN = /no me llega la conexion|circuitos saturados|cupo gratuito/i;
const plain = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * J.A.R.V.I.S. habla primero:
 *  - Saludo al abrir, una vez por franja (mañana / tarde / noche) y día, en todos tus dispositivos
 *    (se marca en la conversación, que está sincronizada).
 *  - Por la mañana, el parte del tiempo: máxima, mínima, lluvia, qué ponerse y si hace falta chaqueta.
 *    Queda en la conversación, así que si le preguntas más, sigue el hilo.
 *  - A la hora del diario, si no has escrito, te lo pregunta en voz alta (una vez al día).
 * iOS no deja sonar nada hasta que tocas la pantalla: entonces lo dice.
 */
export function ProactiveProvider() {
  const { engine, ready } = useSync();
  const { profile, user, userName, features } = useProfile();
  const voice = useVoice();
  const brain = useBrain();
  const location = useRow("user_locations", user ? stableId(user.id, "primary-location") : null);
  const { rows: diary } = useTable("diary_entries");
  const running = useRef(false);
  const mountedAt = useRef(Date.now());
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const brainRef = useRef(brain);
  brainRef.current = brain;
  const locRef = useRef(location);
  locRef.current = location;

  const enabled = !!engine && ready && !!user && !!profile?.onboarding_completed && profile.proactive_enabled !== false;

  /**
   * Lo dice en cuanto se pueda. Si mientras tanto ya le has hablado tú, no te interrumpe:
   * el mensaje queda en la conversación y punto.
   */
  const say = useCallback(
    async (text: string) => {
      const since = mountedAt.current;
      const unlocked = await Promise.race([whenAudioUnlocked().then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 120_000))]);
      if (!unlocked || !engine) return;
      const userSpoke = async () => (await engine.list("chat_messages")).some((m) => m.role === "user" && Date.parse(m.created_at) >= since);
      if (await userSpoke()) return;
      for (let i = 0; i < 20 && voiceRef.current.mode !== "idle"; i++) await new Promise((r) => setTimeout(r, 500));
      if (voiceRef.current.mode !== "idle" || (await userSpoke())) return;
      await voiceRef.current.speak(text);
    },
    [engine],
  );

  // --- Saludo / parte del tiempo
  useEffect(() => {
    if (!enabled || !engine) return;
    let cancelled = false;

    const run = async () => {
      if (running.current || cancelled || document.visibilityState !== "visible") return;
      const now = new Date();
      const slot = slotFor(now.getHours());
      const key = `${localDate(now)}:${slot}`;
      const msgs = await engine.list("chat_messages");
      if (msgs.some((m) => (m.metadata as { proactive?: string } | null)?.proactive === key)) return;
      running.current = true;
      try {
        let text = "";
        const loc = locRef.current;
        if (slot === "morning" && profile?.morning_brief_enabled !== false && loc) {
          const f = await fetchForecast(loc.lat, loc.lng);
          if (f) {
            const extra = `${factsForBrain(f, loc.city ?? null)}\nEs por la mañana y ${userName} acaba de abrir la app. Salúdale por su nombre y dale el parte en 3-4 frases habladas, cercanas, sin listas: cómo estará el día, máxima y mínima, si lloverá, qué ponerse y si necesita chaqueta.`;
            const r = await brainRef.current.send("Buenos días. ¿Qué tiempo hace hoy?", { extra, silent: true, skipUserInsert: true });
            text = r?.reply && r.provider !== "mock" && r.provider !== "none" && !BRAIN_DOWN.test(plain(r.reply)) ? r.reply : briefFallback(f, userName, true);
          }
        }
        if (!text) {
          text =
            slot === "morning"
              ? `Buenos días, ${userName}. Aquí estoy para lo que necesites.`
              : slot === "afternoon"
                ? `Buenas tardes, ${userName}. ¿Qué tal va el día?`
                : `Buenas noches, ${userName}. Aquí sigo si me necesitas.`;
        }
        if (cancelled) return;
        await engine.insert("chat_messages", {
          role: "assistant",
          content: text,
          provider: "proactive",
          metadata: { proactive: key },
        });
        await say(text);
      } finally {
        running.current = false;
      }
    };

    // Un respiro para que la app termine de pintar antes de hablar.
    const t = setTimeout(() => void run(), 1500);
    const onVisible = () => document.visibilityState === "visible" && void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, engine, userName, profile?.morning_brief_enabled, say]);

  // --- Diario: a su hora, si no has escrito, te lo pregunta (una vez al día)
  useEffect(() => {
    if (!enabled || !engine || !features.diary || !profile?.diary_reminder_time) return;
    const check = async () => {
      if (document.visibilityState !== "visible" || running.current) return;
      const [h, m] = profile.diary_reminder_time!.split(":").map(Number);
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
      const today = localDate(now);
      if (diary.some((d) => d.entry_date === today)) return;
      const key = `${today}:diary`;
      const msgs = await engine.list("chat_messages");
      if (msgs.some((x) => (x.metadata as { proactive?: string } | null)?.proactive === key)) return;
      running.current = true;
      try {
        const text = `${userName}, ¿cómo ha ido hoy? Cuando quieras me lo cuentas y lo guardo en tu diario.`;
        await engine.insert("chat_messages", {
          role: "assistant",
          content: text,
          provider: "proactive",
          metadata: { proactive: key },
        });
        await say(text);
      } finally {
        running.current = false;
      }
    };
    void check();
    const t = setInterval(() => void check(), 60_000);
    return () => clearInterval(t);
  }, [enabled, engine, features.diary, profile?.diary_reminder_time, diary, userName, say]);

  return null;
}
