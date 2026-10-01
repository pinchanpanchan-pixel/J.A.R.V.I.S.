"use client";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Ear,
  Fingerprint,
  History,
  House,
  KeyRound,
  LogOut,
  MapPin,
  MessageSquareQuote,
  MessagesSquare,
  PictureInPicture2,
  Plug,
  Siren,
  Ticket,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
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
import { DiscountCodesAdmin } from "@/components/settings/DiscountCodesAdmin";
import { MiniTutorial, ShortcutsTutorial } from "@/components/onboarding/Tutorials";
import { enablePush, pushStatus } from "@/lib/push";
import { PLAN_LABELS } from "@/lib/plans";
import { useProfile } from "@/hooks/useProfile";
import { useProfileActions } from "@/hooks/useProfileActions";
import { useRow, useTable } from "@/hooks/useTable";
import { useAuth } from "@/components/providers/AuthProvider";
import { APP_CONNECTORS, HOME_COMPATIBLE, HOME_CONNECTORS } from "@/connectors/registry";
import { voiceByKey } from "@/lib/voices";
import { stableId } from "@/lib/ids";
import { isMockMode } from "@/lib/env";
import type { VoiceKey } from "@/types/db";

type SectionId =
  | "perfil"
  | "ubicacion"
  | "voz"
  | "activacion"
  | "tu-voz"
  | "proactivo"
  | "diario"
  | "flotante"
  | "conexiones"
  | "hogar"
  | "atajos"
  | "importar"
  | "alertas"
  | "ia"
  | "codigos"
  | "suscripcion"
  | "ayuda";

/** Enlaces antiguos (#conexiones, #hogar…) → apartado nuevo. */
const HASH_ALIASES: Record<string, SectionId> = {
  conexiones: "conexiones",
  hogar: "hogar",
  atajos: "atajos",
  importar: "importar",
  worldmonitor: "alertas",
  avanzado: "ia",
  codigos: "codigos",
  suscripcion: "suscripcion",
  ayuda: "ayuda",
};

interface Item {
  id: SectionId;
  title: string;
  icon: LucideIcon;
  color: string;
  summary?: string;
}

function SettingsInner() {
  const { profile, core, voice, features, isOwner, user, assistantName } = useProfile();
  const { updateProfile, updateCore, updateVoice, saveLocation } = useProfileActions();
  const { signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const location = useRow("user_locations", user ? stableId(user.id, "primary-location") : null);
  const { rows: connectors } = useTable("connectors_tokens");
  const [guide, setGuide] = useState<"how" | "shortcuts" | null>(null);
  const [pushState, setPushState] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [aName, setAName] = useState("");

  useEffect(() => {
    setUserName(core?.user_name ?? "");
    setAName(core?.assistant_name ?? "J.A.R.V.I.S.");
  }, [core?.user_name, core?.assistant_name]);

  useEffect(() => {
    void pushStatus().then(setPushState);
  }, []);

  // Enlaces antiguos con #ancla: se pasan al apartado correspondiente (conservando ?connector=…)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const target = HASH_ALIASES[hash];
    if (!target || params.get("s")) return;
    const q = new URLSearchParams(params.toString());
    q.set("s", target);
    router.replace(`${pathname}?${q}`);
  }, [params, pathname, router]);

  const section = (params.get("s") as SectionId | null) ?? null;
  const open = (id: SectionId) => router.push(`${pathname}?s=${id}`);
  const back = () => router.push(pathname);

  const connectedApps = connectors.filter((c) => c.kind === "app" && c.enabled && (c.status === "connected" || (isMockMode && c.status === "mock"))).length;
  const connectedHome = connectors.filter((c) => c.kind === "home" && c.enabled && (c.status === "connected" || (isMockMode && c.status === "mock"))).length;

  const groups: Array<{ title: string; items: Item[] }> = useMemo(() => {
    const onOff = (b: boolean | undefined) => (b ? "Activado" : "Desactivado");
    return [
      {
        title: "Tú",
        items: [
          { id: "perfil", title: "Perfil", icon: UserRound, color: "#38BDF8", summary: `${core?.user_name ?? "Sin nombre"} · me llamas ${assistantName}` },
          {
            id: "ubicacion",
            title: "Ubicación",
            icon: MapPin,
            color: "#34D399",
            summary: location ? [location.city, location.country].filter(Boolean).join(", ") || "Guardada" : "Sin ubicación",
          },
        ],
      },
      {
        title: "Asistente",
        items: [
          { id: "voz", title: "Voz", icon: AudioLines, color: "#A78BFA", summary: voiceByKey(voice?.voice_key as VoiceKey).name },
          { id: "activacion", title: "Activación y escucha", icon: Ear, color: "#64FFDA", summary: profile?.wake_word_enabled ? `«${assistantName}»` : "Solo tocando la bolita" },
          { id: "tu-voz", title: "Tu voz", icon: Fingerprint, color: "#F472B6", summary: voice?.voiceprint?.length ? (voice.owner_voice_only ? "Solo te respondo a ti" : "Grabada, sin filtrar") : "Sin grabar" },
          { id: "proactivo", title: "Te hablo yo primero", icon: MessagesSquare, color: "#FBBF24", summary: onOff(profile?.proactive_enabled !== false) },
          { id: "diario", title: "Diario y notificaciones", icon: Bell, color: "#F87171", summary: `Te pregunto a las ${profile?.diary_reminder_time ?? "22:30"}` },
          { id: "flotante", title: "Modo flotante", icon: PictureInPicture2, color: "#60A5FA", summary: features.floatingMode ? onOff(profile?.floating_mode_enabled) : "Disponible en Pro" },
        ],
      },
      {
        title: "Conectar",
        items: [
          { id: "conexiones", title: "Conexiones", icon: Plug, color: "#4ADE80", summary: connectedApps ? `${connectedApps} ${connectedApps === 1 ? "app conectada" : "apps conectadas"}` : "Google, Spotify, Notion…" },
          { id: "hogar", title: "Hogar inteligente", icon: House, color: "#FB923C", summary: connectedHome ? `${connectedHome} conectado${connectedHome === 1 ? "" : "s"}` : HOME_COMPATIBLE.slice(0, 2).join(", ") + "…" },
          { id: "atajos", title: "Atajos de voz", icon: Zap, color: "#FACC15" },
          { id: "importar", title: "Importa tu pasado", icon: History, color: "#22D3EE", summary: "Chats de WhatsApp" },
          { id: "alertas", title: "Alertas cerca de ti", icon: Siren, color: "#EF4444", summary: features.worldMonitor ? "Sismos, clima y aire" : "Disponible en Pro Lite y Pro" },
        ],
      },
      ...(isOwner
        ? [
            {
              title: "Propietario",
              items: [
                { id: "ia" as const, title: "Proveedores de IA", icon: KeyRound, color: "#F5C451" },
                { id: "codigos" as const, title: "Códigos de descuento", icon: Ticket, color: "#F5C451" },
              ],
            },
          ]
        : []),
      {
        title: "Más",
        items: [
          ...(!isOwner ? [{ id: "suscripcion" as const, title: "Suscripción", icon: CreditCard, color: "#64FFDA", summary: PLAN_LABELS[profile?.subscription ?? "free"] }] : []),
          { id: "ayuda" as const, title: "Ayuda", icon: BookOpen, color: "#94A3B8", summary: "Cómo funciono y atajos" },
        ],
      },
    ];
  }, [core?.user_name, assistantName, location, voice, profile, features, connectedApps, connectedHome, isOwner]);

  if (!profile) return null;
  const all = groups.flatMap((g) => g.items);
  const current = section ? all.find((i) => i.id === section) : null;

  const body: Record<SectionId, ReactNode> = {
    perfil: (
      <Section title="Cómo nos llamamos">
        <div className="flex flex-col gap-4">
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
    ),
    ubicacion: (
      <Section title="Dónde estás" description="La uso para el tiempo, las alertas cercanas y tu número de emergencias.">
        <LocationSelector initial={location} onSave={async (place, method, addressLine) => saveLocation(place, method, { address_line: addressLine ?? null })} />
      </Section>
    ),
    voz: (
      <Section title="Elige mi voz" description={features.premiumVoice ? "Voces neuronales. Toca ▶ para escuchar cada una." : "Plan Free: voz del sistema. Las 4 voces neuronales llegan con Pro."}>
        <VoiceSelector value={(voice?.voice_key ?? "british_original") as VoiceKey} onChange={(k) => void updateVoice({ voice_key: k })} maxVoices={features.voices} premium={features.premiumVoice} />
      </Section>
    ),
    activacion: (
      <Section title="Cómo me despiertas" description={`Solo me activo con mi nombre: «${assistantName}» u «Oye ${assistantName}». La app tiene que estar abierta.`}>
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
    ),
    "tu-voz": (
      <Section description="Para responder solo cuando hablas tú.">
        {voice?.voiceprint?.length ? (
          <Row label="Responder solo a mi voz" hint="Ignoro a la tele y a otras personas">
            <Toggle checked={!!voice.owner_voice_only} onChange={(v) => void updateVoice({ owner_voice_only: v })} label="Responder solo a mi voz" />
          </Row>
        ) : null}
        <div className={voice?.voiceprint?.length ? "pt-3" : ""}>
          <VoiceprintEnroll compact={!!voice?.voiceprint?.length} />
        </div>
      </Section>
    ),
    proactivo: (
      <Section description="Te saludo al abrir y te aviso de lo importante.">
        <Row label="Saludo y avisos" hint="Al abrir la app, una vez por la mañana, tarde y noche">
          <Toggle checked={profile.proactive_enabled !== false} onChange={(v) => void updateProfile({ proactive_enabled: v })} label="Saludo y avisos" />
        </Row>
        <Row label="Parte del tiempo por la mañana" hint="Máxima, mínima, lluvia y qué ponerte">
          <Toggle checked={profile.morning_brief_enabled !== false} onChange={(v) => void updateProfile({ morning_brief_enabled: v })} label="Parte del tiempo por la mañana" />
        </Row>
      </Section>
    ),
    diario: (
      <>
        <Section title="Hora del diario" description="Cuándo te pregunto cómo fue tu día.">
          <DiaryTimePicker
            time={profile.diary_reminder_time}
            label={profile.diary_reminder_label}
            onChange={(time, label) => void updateProfile({ diary_reminder_time: time, diary_reminder_label: label })}
          />
        </Section>
        <Section title="Notificaciones" description="Para avisarte aunque la app esté cerrada.">
          {pushState === "enabled" ? (
            <p className="flex items-center justify-center gap-2 py-1 text-sm text-arc" data-testid="push-enabled">
              <Check className="h-4 w-4" /> Activadas en este dispositivo
            </p>
          ) : (
            <button
              onClick={async () => {
                const r = await enablePush();
                setPushState(r);
              }}
              className="jv-btn-ghost w-full text-sm"
            >
              <Bell className="h-4 w-4" /> Activar notificaciones
            </button>
          )}
          {pushState && pushState !== "enabled" && pushState !== "default" && (
            <p className="mt-2 text-center text-[11px] text-white/45">
              {pushState === "local_only"
                ? "Te aviso mientras la app esté abierta (falta configurar el servidor de notificaciones)."
                : pushState === "denied"
                  ? "Has bloqueado las notificaciones. Actívalas en los ajustes del sistema."
                  : "En iPhone: añade la app a la pantalla de inicio para recibir notificaciones."}
            </p>
          )}
        </Section>
      </>
    ),
    flotante: (
      <Section description="Una bolita siempre a mano para hablarme desde cualquier pantalla. En Chrome o Edge de ordenador puedes sacarla a una ventana encima de tus otras apps.">
        <Row label="Modo flotante" hint={features.floatingMode ? "Bolita arrastrable" : "Disponible en Pro"}>
          <Toggle checked={profile.floating_mode_enabled} disabled={!features.floatingMode} onChange={(v) => void updateProfile({ floating_mode_enabled: v })} label="Modo flotante" />
        </Row>
      </Section>
    ),
    conexiones: (
      <Section id="conexiones" title="Tus apps" description={features.connectors ? "Toca una app para conectarla con su inicio de sesión." : "Las conexiones se activan con Pro Lite o Pro."}>
        <ConnectorGrid connectors={APP_CONNECTORS} maxEnabled={features.maxConnectors} locked={!features.connectors} returnTo="/settings?s=conexiones" />
      </Section>
    ),
    hogar: (
      <Section id="hogar" description={`Compatible con: ${HOME_COMPATIBLE.join(", ")}.`}>
        <ConnectorGrid connectors={HOME_CONNECTORS} locked={!features.smartHome} returnTo="/settings?s=hogar" />
      </Section>
    ),
    atajos: (
      <Section id="atajos" description="Frases que hacen algo al momento. Las de serie se encienden o apagan; las tuyas se editan.">
        <ShortcutsManager locked={!features.shortcuts} />
      </Section>
    ),
    importar: (
      <Section id="importar" description="Exporta un chat en WhatsApp (Más → Exportar chat → Incluir archivos) y súbelo aquí.">
        <WhatsAppImport locked={!features.importPast} />
      </Section>
    ),
    alertas: (
      <Section id="worldmonitor" description={features.worldMonitor ? "Te aviso si pasa algo cerca de ti." : "Disponible en Pro Lite y Pro."}>
        <WorldMonitorSettings locked={!features.worldMonitor} />
      </Section>
    ),
    ia: isOwner ? (
      <Section id="avanzado">
        <AIProvidersManager />
      </Section>
    ) : null,
    codigos: isOwner ? (
      <Section id="codigos" description="Solo cuentas propietarias. Crea, activa o borra códigos.">
        <DiscountCodesAdmin />
      </Section>
    ) : null,
    suscripcion: (
      <Section id="suscripcion">
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
    ),
    ayuda: (
      <Section id="ayuda">
        <button onClick={() => setGuide("how")} className="flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left hover:bg-white/[0.04]">
          <BookOpen className="h-5 w-5 text-arc" />
          <span className="flex-1 text-[15px]">Cómo funciono</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>
        <button onClick={() => setGuide("shortcuts")} className="flex w-full items-center gap-3 rounded-2xl px-1 py-3 text-left hover:bg-white/[0.04]">
          <MessageSquareQuote className="h-5 w-5 text-arc" />
          <span className="flex-1 text-[15px]">Atajos de voz</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>
      </Section>
    ),
  };

  return (
    <div className="pb-10 pt-2">
      <AnimatePresence mode="wait" initial={false}>
        {current ? (
          <motion.div key={current.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18 }} className="flex flex-col gap-6">
            <header className="flex items-center gap-2">
              <button onClick={back} className="-ml-2 flex items-center gap-0.5 rounded-full py-1.5 pl-1 pr-3 text-[15px] text-arc hover:bg-white/[0.06]" aria-label="Volver a Ajustes">
                <ChevronLeft className="h-5 w-5" /> Ajustes
              </button>
            </header>
            <h1 className="-mt-3 text-2xl font-semibold tracking-tight">{current.title}</h1>
            {body[current.id]}
          </motion.div>
        ) : (
          <motion.div key="home" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }} className="flex flex-col gap-7">
            <header className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-arc/40 to-sky-500/30 text-xl font-semibold">
                {(core?.user_name ?? profile.email ?? "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
                <p className="truncate text-sm text-white/45">{profile.email}</p>
              </div>
              <PlanBadge isOwner={isOwner} plan={profile.subscription} />
            </header>

            {groups.map((g) => (
              <section key={g.title}>
                <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-white/40">{g.title}</h2>
                <div className="jv-card divide-y divide-white/[0.06] overflow-hidden p-0">
                  {g.items.map((it) => (
                    <button key={it.id} onClick={() => open(it.id)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.04]" data-testid={`settings-${it.id}`}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: `${it.color}26`, color: it.color }}>
                        <it.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] leading-tight">{it.title}</span>
                        {it.summary && <span className="mt-0.5 block truncate text-[12.5px] text-white/45">{it.summary}</span>}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                    </button>
                  ))}
                </div>
              </section>
            ))}

            <button onClick={() => void signOut()} className="jv-btn-ghost text-red-300">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
            {isMockMode && <p className="-mt-4 text-center text-[11px] text-white/30">Modo simulado · los datos viven en este navegador</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={guide !== null} onClose={() => setGuide(null)} title={guide === "shortcuts" ? "Atajos de voz" : "Cómo funciono"}>
        {guide === "how" && <MiniTutorial onDone={() => setGuide(null)} />}
        {guide === "shortcuts" && <ShortcutsTutorial onDone={() => setGuide(null)} />}
      </Sheet>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
