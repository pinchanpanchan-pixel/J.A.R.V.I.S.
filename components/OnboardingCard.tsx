"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useProfileActions } from "@/hooks/useProfileActions";
import { useRow } from "@/hooks/useTable";
import { stableId } from "@/lib/ids";
import { VoiceSelector } from "@/components/VoiceSelector";
import { ConnectorGrid } from "@/components/ConnectorGrid";
import { LocationSelector } from "@/components/LocationSelector";
import { PaymentCard } from "@/components/PaymentCard";
import { DiaryTimePicker } from "@/components/DiaryTimePicker";
import { MiniTutorial, ShortcutsTutorial } from "@/components/onboarding/Tutorials";
import { APP_CONNECTORS, HOME_CONNECTORS } from "@/connectors/registry";
import type { VoiceKey } from "@/types/db";

type StepId = "identity" | "voice" | "apps" | "home" | "location" | "payment" | "diary" | "tutorial" | "shortcuts";

/** Numeración de la especificación (Paso 1..9; el 10 es la comprobación de propietario). */
const ALL_STEPS: Array<{ n: number; id: StepId; title: string; subtitle?: string }> = [
  { n: 1, id: "identity", title: "Empecemos por lo básico" },
  { n: 2, id: "voice", title: "Elige mi voz" },
  { n: 3, id: "apps", title: "Conecta tu mundo" },
  { n: 4, id: "home", title: "Tu hogar" },
  { n: 5, id: "location", title: "¿Dónde estás, hermano?", subtitle: "Necesito esto para cuidarte." },
  { n: 6, id: "payment", title: "Desbloquea a tu hermano completo" },
  { n: 7, id: "diary", title: "Guardaré tu diario privado", subtitle: "¿Cuándo quieres que te pregunte cómo fue tu día?" },
  { n: 8, id: "tutorial", title: "Cómo funciono" },
  { n: 9, id: "shortcuts", title: "Atajos de voz" },
];

/**
 * Onboarding dentro de una tarjeta centrada (NO pantalla completa). Fondo azul marino
 * desenfocado con la app principal visible detrás. El progreso se sincroniza, así que
 * se puede empezar en el iPhone y terminar en el Mac.
 */
export function OnboardingCard() {
  const { profile, core, voice, isOwner, features, user } = useProfile();
  const { updateProfile, updateCore, updateVoice, saveLocation } = useProfileActions();
  const location = useRow("user_locations", user ? stableId(user.id, "primary-location") : null);

  // Paso 10 — comprobación de propietario: el propietario nunca ve el pago (5 → 7).
  const steps = useMemo(() => ALL_STEPS.filter((s) => !(s.id === "payment" && isOwner)), [isOwner]);

  const [stepN, setStepN] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  useEffect(() => {
    if (stepN === null && profile) setStepN(Math.max(1, profile.onboarding_step || 1));
  }, [profile, stepN]);

  const idx = Math.max(
    0,
    steps.findIndex((s) => s.n >= (stepN ?? 1)),
  );
  const step = steps[idx] ?? steps[0];

  const go = async (delta: 1 | -1) => {
    const nextIdx = idx + delta;
    setDir(delta);
    if (nextIdx >= steps.length) {
      await updateProfile({ onboarding_completed: true, onboarding_step: 10 });
      return;
    }
    if (nextIdx < 0) return;
    const n = steps[nextIdx].n;
    setStepN(n);
    await updateProfile({ onboarding_step: n });
  };
  const next = () => void go(1);

  // --- Paso 1: identidad
  const [userName, setUserName] = useState("");
  const [assistantName, setAssistantName] = useState("J.A.R.V.I.S.");
  useEffect(() => {
    if (core?.user_name) setUserName(core.user_name);
    if (core?.assistant_name) setAssistantName(core.assistant_name);
  }, [core?.user_name, core?.assistant_name]);

  let body: ReactNode = null;
  let canContinue = true;
  let showContinue = true;

  switch (step.id) {
    case "identity":
      canContinue = userName.trim().length > 0 && assistantName.trim().length > 0;
      body = (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white/80">¿Cómo te llamo, hermano?</span>
            <input className="jv-input" placeholder="Tu nombre" value={userName} autoFocus onChange={(e) => setUserName(e.target.value)} maxLength={40} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-white/80">¿Cómo quieres llamarme?</span>
            <input className="jv-input" value={assistantName} onChange={(e) => setAssistantName(e.target.value)} maxLength={30} />
            <span className="text-xs text-white/40">Será también mi palabra de activación: «Hey {assistantName.trim() || "J.A.R.V.I.S."}».</span>
          </label>
        </div>
      );
      break;
    case "voice":
      body = (
        <VoiceSelector
          value={(voice?.voice_key ?? "british_original") as VoiceKey}
          onChange={(k) => void updateVoice({ voice_key: k })}
          maxVoices={features.voices}
          premium={features.premiumVoice}
        />
      );
      break;
    case "apps":
      showContinue = true;
      body = <ConnectorGrid connectors={APP_CONNECTORS} onSkip={next} />;
      break;
    case "home":
      body = <ConnectorGrid connectors={HOME_CONNECTORS} onSkip={next} />;
      break;
    case "location":
      canContinue = !!location;
      body = <LocationSelector initial={location} onSave={async (place, method, addressLine) => saveLocation(place, method, { address_line: addressLine ?? null })} />;
      break;
    case "payment":
      body = <PaymentCard onContinueFree={next} />;
      break;
    case "diary":
      canContinue = !!profile?.diary_reminder_time;
      body = (
        <DiaryTimePicker
          time={profile?.diary_reminder_time ?? null}
          label={profile?.diary_reminder_label ?? null}
          onChange={(time, label) => void updateProfile({ diary_reminder_time: time, diary_reminder_label: label })}
        />
      );
      break;
    case "tutorial":
      showContinue = false;
      body = <MiniTutorial onDone={next} />;
      break;
    case "shortcuts":
      showContinue = false;
      body = <ShortcutsTutorial onDone={next} />;
      break;
  }

  const onContinue = async () => {
    if (step.id === "identity") {
      await updateCore({ user_name: userName.trim(), assistant_name: assistantName.trim() });
    }
    next();
  };

  if (!profile || stepN === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#0A192F]/80 to-[#001122]/85 px-4 py-[max(env(safe-area-inset-top),24px)] backdrop-blur-xl">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="my-auto w-full max-w-[420px] overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0F2440]/95 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        {/* Progreso */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void go(-1)}
            disabled={idx === 0}
            className="-ml-2 rounded-full p-1.5 text-white/50 transition hover:bg-white/10 disabled:invisible"
            aria-label="Atrás"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5" aria-label={`Paso ${idx + 1} de ${steps.length}`}>
            {steps.map((s, k) => (
              <span key={s.id} className={`h-1.5 rounded-full transition-all duration-300 ${k === idx ? "w-6 bg-arc" : k < idx ? "w-1.5 bg-arc/60" : "w-1.5 bg-white/20"}`} />
            ))}
          </div>
          <span className="w-8 text-right text-[11px] text-white/35">
            {idx + 1}/{steps.length}
          </span>
        </div>

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <h2 id="onb-title" className="text-[22px] font-semibold leading-tight tracking-tight text-white">
              {step.title}
            </h2>
            {step.subtitle && <p className="mt-1 text-sm text-white/60">{step.subtitle}</p>}
            <div className="mt-5">{body}</div>
          </motion.div>
        </AnimatePresence>

        {showContinue && step.id !== "payment" && (
          <button type="button" className="jv-btn-primary mt-6 w-full" disabled={!canContinue} onClick={() => void onContinue()}>
            Continuar
          </button>
        )}
      </motion.div>
    </div>
  );
}
