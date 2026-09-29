"use client";
import { useEffect, useState } from "react";
import { LogOut, MapPin } from "lucide-react";
import { Section, Row } from "@/components/settings/Section";
import { PlanBadge } from "@/components/settings/PlanBadge";
import { Toggle } from "@/components/ui/Toggle";
import { Sheet } from "@/components/ui/Sheet";
import { VoiceSelector } from "@/components/VoiceSelector";
import { DiaryTimePicker } from "@/components/DiaryTimePicker";
import { LocationSelector } from "@/components/LocationSelector";
import { ConnectorGrid } from "@/components/ConnectorGrid";
import { PaymentCard } from "@/components/PaymentCard";
import { useProfile } from "@/hooks/useProfile";
import { useProfileActions } from "@/hooks/useProfileActions";
import { useRow } from "@/hooks/useTable";
import { useAuth } from "@/components/providers/AuthProvider";
import { APP_CONNECTORS, HOME_CONNECTORS } from "@/connectors/registry";
import { stableId } from "@/lib/ids";
import { isMockMode } from "@/lib/env";
import type { VoiceKey } from "@/types/db";

export default function SettingsPage() {
  const { profile, core, voice, features, isOwner, user, assistantName } = useProfile();
  const { updateProfile, updateCore, updateVoice, saveLocation } = useProfileActions();
  const { signOut } = useAuth();
  const location = useRow("user_locations", user ? stableId(user.id, "primary-location") : null);
  const [locOpen, setLocOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [aName, setAName] = useState("");
  useEffect(() => {
    setUserName(core?.user_name ?? "");
    setAName(core?.assistant_name ?? "J.A.R.V.I.S.");
  }, [core?.user_name, core?.assistant_name]);

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-6 pb-10 pt-2">
      <header className="flex flex-col items-start gap-3">
        <PlanBadge isOwner={isOwner} plan={profile.subscription} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-white/45">{profile.email}</p>
        </div>
      </header>

      <Section title="Identidad">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50">Cómo te llamo</span>
            <input className="jv-input" value={userName} onChange={(e) => setUserName(e.target.value)} onBlur={() => userName.trim() && void updateCore({ user_name: userName.trim() })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50">Cómo me llamas (y mi palabra de activación)</span>
            <input className="jv-input" value={aName} onChange={(e) => setAName(e.target.value)} onBlur={() => aName.trim() && void updateCore({ assistant_name: aName.trim() })} />
          </label>
        </div>
      </Section>

      <Section title="Voz" description={features.premiumVoice ? "Voces premium con ElevenLabs." : "Plan Free: voz del sistema. Las 4 voces premium llegan con Pro."}>
        <VoiceSelector value={(voice?.voice_key ?? "british_original") as VoiceKey} onChange={(k) => void updateVoice({ voice_key: k })} maxVoices={features.voices} />
      </Section>

      <Section title="Activación" description="Cómo me despiertas. La app tiene que estar abierta.">
        <Row label="Doble palmada" hint="Dos palmadas seguidas">
          <Toggle checked={profile.wake_clap_enabled} onChange={(v) => void updateProfile({ wake_clap_enabled: v })} label="Doble palmada" />
        </Row>
        <Row label="Botón rojo" hint="Mantener pulsado para hablar">
          <Toggle checked={profile.wake_button_enabled} onChange={(v) => void updateProfile({ wake_button_enabled: v })} label="Botón rojo" />
        </Row>
        <Row label="Palabra de activación" hint={`«${assistantName}» o «Hey ${assistantName}»`}>
          <Toggle checked={profile.wake_word_enabled} onChange={(v) => void updateProfile({ wake_word_enabled: v })} label="Palabra de activación" />
        </Row>
      </Section>

      <Section title="Modo flotante">
        <Row label="Modo flotante siempre visible" hint={features.floatingMode ? "Punto arrastrable encima de todo" : "Disponible en Pro"}>
          <Toggle
            checked={profile.floating_mode_enabled}
            disabled={!features.floatingMode}
            onChange={(v) => void updateProfile({ floating_mode_enabled: v })}
            label="Modo flotante"
          />
        </Row>
      </Section>

      <Section title="Diario" description="Cuándo te pregunto cómo fue tu día.">
        <DiaryTimePicker
          time={profile.diary_reminder_time}
          label={profile.diary_reminder_label}
          onChange={(time, label) => void updateProfile({ diary_reminder_time: time, diary_reminder_label: label })}
        />
      </Section>

      <Section title="Ubicación" description="La uso para WorldMonitor: sismos, clima y aire cerca de ti.">
        <button onClick={() => setLocOpen(true)} className="flex w-full items-center gap-3 text-left">
          <MapPin className="h-5 w-5 shrink-0 text-arc" />
          <span className="flex-1 text-sm">
            {location ? [location.city, location.state, location.country].filter(Boolean).join(", ") || location.formatted_address : "Sin ubicación. Toca para configurarla."}
          </span>
          <span className="text-sm text-arc">Cambiar</span>
        </button>
      </Section>

      <Section id="conexiones" title="Conexiones" description={features.connectors ? undefined : "Las conexiones se activan con Pro Lite o Pro."}>
        <ConnectorGrid connectors={APP_CONNECTORS} maxEnabled={features.maxConnectors} locked={!features.connectors} />
      </Section>

      <Section id="hogar" title="Hogar inteligente">
        <ConnectorGrid connectors={HOME_CONNECTORS} locked={!features.smartHome} />
      </Section>

      {!isOwner && (
        <Section id="suscripcion" title="Suscripción">
          <PaymentCard />
        </Section>
      )}

      <button onClick={() => void signOut()} className="jv-btn-ghost text-red-300">
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
      {isMockMode && <p className="text-center text-[11px] text-white/30">Modo simulado · los datos viven en este navegador</p>}

      <Sheet open={locOpen} onClose={() => setLocOpen(false)} title="¿Dónde estás, hermano?">
        <LocationSelector
          initial={location}
          onSave={async (place, method, addressLine) => {
            await saveLocation(place, method, { address_line: addressLine ?? null });
            setTimeout(() => setLocOpen(false), 600);
          }}
        />
      </Sheet>
    </div>
  );
}
