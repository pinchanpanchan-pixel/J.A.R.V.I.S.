"use client";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, LogOut, MapPin, MessageSquareQuote } from "lucide-react";
import { MiniTutorial, ShortcutsTutorial } from "@/components/onboarding/Tutorials";
import { Section, Row } from "@/components/settings/Section";
import { PlanBadge } from "@/components/settings/PlanBadge";
import { Toggle } from "@/components/ui/Toggle";
import { Sheet } from "@/components/ui/Sheet";
import { VoiceSelector } from "@/components/VoiceSelector";
import { VoiceprintEnroll } from "@/components/VoiceprintEnroll";
import { ClapSensitivity } from "@/components/settings/ClapSensitivity";
import { DiaryTimePicker } from "@/components/DiaryTimePicker";
import { LocationSelector } from "@/components/LocationSelector";
import { ConnectorGrid } from "@/components/ConnectorGrid";
import { PaymentCard } from "@/components/PaymentCard";
import { AIProvidersManager } from "@/components/settings/AIProvidersManager";
import { ShortcutsManager } from "@/components/settings/ShortcutsManager";
import { WorldMonitorSettings } from "@/components/settings/WorldMonitorSettings";
import { WhatsAppImport } from "@/components/settings/WhatsAppImport";
import { enablePush } from "@/lib/push";
import { IosShortcuts } from "@/components/settings/IosShortcuts";
import { DiscountCodesAdmin } from "@/components/settings/DiscountCodesAdmin";
import { PLAN_LABELS } from "@/lib/plans";
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
  const [guide, setGuide] = useState<"how" | "shortcuts" | null>(null);
  const [pushState, setPushState] = useState<string | null>(null);
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

      <Section title="Voz" description={features.premiumVoice ? "Voces neuronales de Google." : "Plan Free: voz del sistema. Las 4 voces neuronales llegan con Pro."}>
        <VoiceSelector value={(voice?.voice_key ?? "british_original") as VoiceKey} onChange={(k) => void updateVoice({ voice_key: k })} maxVoices={features.voices}
          premium={features.premiumVoice} />
      </Section>

      <Section title="Activación" description={`Solo me activo con mi nombre: «${assistantName}» o «Oye ${assistantName}». La app tiene que estar abierta.`}>
        <Row label="Palabra de activación" hint={`«${assistantName}», «Hey ${assistantName}» u «Oye ${assistantName}»`}>
          <Toggle checked={profile.wake_word_enabled} onChange={(v) => void updateProfile({ wake_word_enabled: v })} label="Palabra de activación" />
        </Row>
        <Row label="Mantener pulsada la bolita" hint="Hablas mientras la sujetas">
          <Toggle checked={profile.wake_button_enabled} onChange={(v) => void updateProfile({ wake_button_enabled: v })} label="Mantener pulsada la bolita" />
        </Row>
        <Row label="Doble palmada" hint="Opcional. Un golpe fuerte también puede activarme">
          <Toggle checked={profile.wake_clap_enabled} onChange={(v) => void updateProfile({ wake_clap_enabled: v })} label="Doble palmada" />
        </Row>
        {profile.wake_clap_enabled && <ClapSensitivity threshold={Number(voice?.clap_threshold ?? 0.35)} onCommit={(t) => void updateVoice({ clap_threshold: t })} />}
      </Section>

      <Section title="Tu voz" description="Para responder solo cuando hablas tú.">
        {voice?.voiceprint?.length ? (
          <Row label="Responder solo a mi voz" hint="Ignoro a la tele y a otras personas">
            <Toggle checked={!!voice.owner_voice_only} onChange={(v) => void updateVoice({ owner_voice_only: v })} label="Responder solo a mi voz" />
          </Row>
        ) : null}
        <div className={voice?.voiceprint?.length ? "pt-3" : ""}>
          <VoiceprintEnroll compact={!!voice?.voiceprint?.length} />
        </div>
      </Section>

      <Section title="Te hablo yo primero" description="Te saludo al abrir y te aviso de lo importante.">
        <Row label="Saludo y avisos" hint="Al abrir la app, una vez por la mañana, tarde y noche">
          <Toggle checked={profile.proactive_enabled !== false} onChange={(v) => void updateProfile({ proactive_enabled: v })} label="Saludo y avisos" />
        </Row>
        <Row label="Parte del tiempo por la mañana" hint="Máxima, mínima, lluvia y qué ponerte">
          <Toggle checked={profile.morning_brief_enabled !== false} onChange={(v) => void updateProfile({ morning_brief_enabled: v })} label="Parte del tiempo por la mañana" />
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
        <button
          onClick={async () => {
            const r = await enablePush();
            setPushState(r);
          }}
          className="jv-btn-ghost mt-3 w-full text-sm"
        >
          Activar notificaciones
        </button>
        {pushState && (
          <p className="mt-2 text-center text-[11px] text-white/45">
            {pushState === "enabled"
              ? "Notificaciones activadas en este dispositivo."
              : pushState === "local_only"
                ? "Te aviso mientras la app esté abierta (falta configurar el servidor de notificaciones)."
                : pushState === "denied"
                  ? "Has bloqueado las notificaciones. Actívalas en los ajustes del sistema."
                  : "En iPhone: añade la app a la pantalla de inicio para recibir notificaciones."}
          </p>
        )}
      </Section>

      <Section id="worldmonitor" title="WorldMonitor" description={features.worldMonitor ? "Te aviso si pasa algo cerca de ti." : "Disponible en Pro Lite y Pro."}>
        <WorldMonitorSettings locked={!features.worldMonitor} />
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

      <Section id="atajos-ios" title="Apps de Apple (Atajos de iOS)" description="Notas, Recordatorios, Contactos y Calendario de Apple llegan a tu memoria con un Atajo.">
        <IosShortcuts />
      </Section>

      <Section id="hogar" title="Hogar inteligente">
        <ConnectorGrid connectors={HOME_CONNECTORS} locked={!features.smartHome} />
      </Section>

      <Section id="atajos" title="Atajos">
        <ShortcutsManager locked={!features.shortcuts} />
      </Section>

      <Section id="importar" title="Importa tu pasado" description="Exporta un chat en WhatsApp (Más → Exportar chat → Incluir archivos) y súbelo aquí.">
        <WhatsAppImport locked={!features.importPast} />
      </Section>

      {isOwner ? (
        <>
          <Section id="avanzado" title="Proveedores de IA" description="Solo cuentas propietarias.">
            <AIProvidersManager />
          </Section>
          <Section id="codigos" title="Códigos de descuento" description="Solo cuentas propietarias. Crea, activa o borra códigos.">
            <DiscountCodesAdmin />
          </Section>
        </>
      ) : (
        <Section id="suscripcion" title="Suscripción">
          {profile.subscription === "free" ? (
            <PaymentCard />
          ) : (
            <div className="flex flex-col gap-1 text-sm">
              <p>
                Plan <b>{PLAN_LABELS[profile.subscription]}</b>
                {profile.subscription_period === "lifetime" ? " · de por vida" : profile.subscription_period === "yearly" ? " · anual" : " · mensual"}
              </p>
              {profile.subscription_renews_at && <p className="text-white/50">Se renueva el {new Date(profile.subscription_renews_at).toLocaleDateString("es-ES")}.</p>}
              {profile.subscription === "pro_lite" && <p className="mt-2 text-white/60">¿Quieres todo ilimitado? Pásate a Pro desde tu gestor de pagos.</p>}
            </div>
          )}
        </Section>
      )}

      <Section id="ayuda" title="Ayuda">
        <button onClick={() => setGuide("how")} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left hover:bg-white/[0.04]">
          <BookOpen className="h-5 w-5 text-arc" />
          <span className="flex-1 text-[15px]">Cómo funciono</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>
        <button onClick={() => setGuide("shortcuts")} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left hover:bg-white/[0.04]">
          <MessageSquareQuote className="h-5 w-5 text-arc" />
          <span className="flex-1 text-[15px]">Atajos de voz</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>
      </Section>

      <Sheet open={guide !== null} onClose={() => setGuide(null)} title={guide === "shortcuts" ? "Atajos de voz" : "Cómo funciono"}>
        {guide === "how" && <MiniTutorial onDone={() => setGuide(null)} />}
        {guide === "shortcuts" && <ShortcutsTutorial onDone={() => setGuide(null)} />}
      </Sheet>

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
