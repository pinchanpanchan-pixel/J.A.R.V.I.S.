"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ear, EarOff, MessagesSquare, PictureInPicture2, SendHorizonal, Square } from "lucide-react";
import type { DotMode } from "@/components/LiquidDot";
import { StyledDot } from "@/components/StyleDots";
import { useUiStyle } from "@/components/providers/StyleController";
import { ChatHistory } from "@/components/ChatHistory";
import { Sheet } from "@/components/ui/Sheet";
import { SyncBadge } from "@/components/MessageCenter";
import { useProfile } from "@/hooks/useProfile";
import { useProfileActions } from "@/hooks/useProfileActions";
import { useTable } from "@/hooks/useTable";
import { useAssistant } from "@/hooks/useAssistant";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useVoice } from "@/components/providers/VoiceProvider";

const byCreatedAsc = (a: { created_at: string }, b: { created_at: string }) => Date.parse(a.created_at) - Date.parse(b.created_at);

/** Pestaña Cerebro: el punto líquido, la transcripción en vivo y la conversación. */
export default function BrainPage() {
  const { assistantName, userName, profile, features } = useProfile();
  const { updateProfile } = useProfileActions();
  const online = useOnlineStatus();
  const { rows: messages } = useTable("chat_messages", { sort: byCreatedAsc });
  const { handle, busy: textThinking, error } = useAssistant();
  const voice = useVoice();
  const style = useUiStyle();
  const [text, setText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pill, setPill] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // La píldora muestra: lo que dices (en vivo) → la respuesta
  useEffect(() => {
    if (voice.mode === "listening") setPill(voice.transcript);
  }, [voice.mode, voice.transcript]);
  useEffect(() => {
    if (voice.reply) setPill(voice.reply);
  }, [voice.reply]);
  useEffect(() => {
    if (voice.notice) setPill(voice.notice);
  }, [voice.notice]);

  const thinking = textThinking || voice.mode === "thinking";
  const mode: DotMode =
    voice.mode === "listening" ? "listening" : voice.mode === "speaking" ? "speaking" : thinking ? "thinking" : !online ? "offline" : "idle";

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    setPill(t);
    const res = await handle(t);
    if (res?.reply) await voice.speak(res.reply);
  };

  const toggleFloating = () => {
    if (!features.floatingMode) {
      setToast("El modo flotante es de Pro, hermano.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    const on = !profile?.floating_mode_enabled;
    void updateProfile({ floating_mode_enabled: on });
    setToast(on ? "Modo flotante: te dejo una bolita para hablarme desde cualquier pantalla." : "Modo flotante desactivado.");
    setTimeout(() => setToast(null), 3500);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 6 ? "¿Todavía despierto" : h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
  }, []);

  // La bolita es el control: tocar = hablar; mantener pulsada = dictar mientras la sujetas.
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; held: boolean }>({ timer: null, held: false });
  const holdEnabled = profile?.wake_button_enabled !== false;
  const onDotDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    press.current.held = false;
    if (!holdEnabled) return;
    press.current.timer = setTimeout(() => {
      press.current.held = true;
      voice.holdStart();
    }, 380);
  };
  const onDotUp = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
    if (press.current.held) {
      press.current.held = false;
      voice.holdEnd();
      return;
    }
    if (voice.mode === "idle") voice.activate("button");
    else voice.stop();
  };
  const onDotCancel = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
    if (press.current.held) voice.holdEnd();
    press.current.held = false;
  };

  const pillText =
    style === "pulso" && voice.mode === "listening" ? "Escuchando…" : voice.mode === "listening" ? pill || "Te escucho…" : thinking ? (voice.transcript ? `«${voice.transcript}»` : "Pensando…") : pill;

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col">
      <header className="flex items-center justify-between py-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {assistantName}
            {style === "pulso" && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/70" data-testid="active-indicator">
                <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-arc shadow-[0_0_8px_rgb(var(--accent))]" : "bg-white/30"}`} />
                {online ? "Activo" : "Sin conexión"}
              </span>
            )}
          </h1>
          <SyncBadge />
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleFloating}
            aria-pressed={!!profile?.floating_mode_enabled}
            aria-label="Modo flotante"
            title="Modo flotante: una bolita siempre a mano para hablarme desde cualquier pantalla"
            className={`rounded-full border p-2.5 ${profile?.floating_mode_enabled ? "border-arc bg-arc/20 text-arc" : "border-transparent bg-white/5 text-white/70 hover:bg-white/10"}`}
          >
            <PictureInPicture2 className="h-5 w-5" />
          </motion.button>
          <button onClick={() => setHistoryOpen(true)} className="relative rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10" aria-label="Conversación" title="Conversación">
            <MessagesSquare className="h-5 w-5" />
            {messages.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-arc" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {style !== "pulso" && (
          <p
            className={
              style === "constelacion" ? "font-greeting text-center text-[34px] leading-tight text-white/90" : "text-center text-sm text-white/45"
            }
            data-testid="greeting"
          >
            {greeting}, {userName}
            {greeting.startsWith("¿") ? "?" : "."}
          </p>
        )}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
          <button
            type="button"
            aria-label={voice.mode === "idle" ? `Hablar con ${assistantName}` : "Parar"}
            onPointerDown={onDotDown}
            onPointerUp={onDotUp}
            onPointerLeave={onDotCancel}
            onPointerCancel={onDotCancel}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              if (voice.mode === "idle") voice.activate("button");
              else voice.stop();
            }}
            className="touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-arc/60"
            style={{ WebkitTouchCallout: "none" }}
            data-testid="dot-button"
            data-notip
          >
            <StyledDot mode={mode} getLevel={voice.getLevel} size={200} />
          </button>
        </motion.div>

        {/* Píldora de transcripción en vivo */}
        <div className="flex min-h-[52px] w-full justify-center">
          <AnimatePresence mode="wait">
            {pillText && (
              <motion.div
                key={voice.mode + (thinking ? "t" : "") + (voice.mode === "listening" ? "" : pillText)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="selectable max-w-[90%] rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-center text-sm text-white/85 backdrop-blur"
                aria-live="polite"
                data-testid="transcript-pill"
              >
                {pillText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {error && <p className="text-center text-xs text-red-300">{error}</p>}

        {/* Escucha: un interruptor claro (oreja) y «Parar» solo cuando hace falta */}
        <div className="flex min-h-[44px] items-center gap-2.5">
          {voice.wakeWanted && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => void voice.toggleWake()}
              aria-pressed={voice.wakeActive}
              aria-label={voice.wakeActive ? "Apagar la escucha" : "Encender la escucha"}
              title={voice.wakeActive ? `Te oigo si dices «${assistantName}». Toca para apagar.` : "Toca para que te oiga cuando digas mi nombre"}
              className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] transition ${
                voice.wakeActive ? "border-arc/30 bg-arc/10 text-arc" : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08]"
              }`}
            >
              {voice.wakeActive ? <Ear className="h-4 w-4" /> : <EarOff className="h-4 w-4" />}
              {voice.wakeActive ? `Di «${assistantName.replace(/\./g, "")}»` : voice.wakePaused ? "Escucha apagada" : "Activar escucha"}
            </motion.button>
          )}
          <AnimatePresence>
            {voice.mode !== "idle" && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={voice.stop}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[13px] text-white/75 hover:bg-white/10"
                aria-label="Parar"
              >
                <Square className="h-3.5 w-3.5" /> Parar
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {voice.mode === "idle" && !pillText && style !== "pulso" && (
          <p className="-mt-3 text-center text-xs text-white/35">Toca la bolita para hablar{holdEnabled ? " · mantenla pulsada para dictar" : ""}</p>
        )}
      </div>

      {/* Siempre por encima de la barra de abajo (también en el ordenador) */}
      <form
        onSubmit={submit}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+84px)] z-20 mt-6 flex items-center gap-3 pb-2 pt-4"
      >
        <input className="jv-input rounded-full" placeholder="Escríbeme, hermano…" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send" />
        <button type="submit" disabled={!text.trim() || thinking} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-arc disabled:opacity-40" aria-label="Enviar">
          <SendHorizonal className="h-5 w-5" />
        </button>
      </form>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed left-1/2 top-20 z-40 w-max max-w-[90vw] -translate-x-1/2 rounded-full bg-navy-700 px-4 py-2 text-center text-sm">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Conversación">
        <ChatHistory messages={messages.slice(-100)} assistantName={assistantName} />
      </Sheet>
    </div>
  );
}
