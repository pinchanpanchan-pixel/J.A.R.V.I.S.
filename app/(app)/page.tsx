"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ear, MessagesSquare, PictureInPicture2, SendHorizonal, Square } from "lucide-react";
import { LiquidDot, type DotMode } from "@/components/LiquidDot";
import { HoldToTalk } from "@/components/HoldToTalk";
import { ChatHistory } from "@/components/ChatHistory";
import { Sheet } from "@/components/ui/Sheet";
import { SyncBadge } from "@/components/MessageCenter";
import { useProfile } from "@/hooks/useProfile";
import { useProfileActions } from "@/hooks/useProfileActions";
import { useTable } from "@/hooks/useTable";
import { useBrain } from "@/hooks/useBrain";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useVoice } from "@/components/providers/VoiceProvider";

const byCreatedAsc = (a: { created_at: string }, b: { created_at: string }) => Date.parse(a.created_at) - Date.parse(b.created_at);

/** Pestaña Cerebro: el punto líquido, la transcripción en vivo y la conversación. */
export default function BrainPage() {
  const { assistantName, userName, profile, features } = useProfile();
  const { updateProfile } = useProfileActions();
  const online = useOnlineStatus();
  const { rows: messages } = useTable("chat_messages", { sort: byCreatedAsc });
  const { send, thinking: textThinking, error } = useBrain();
  const voice = useVoice();
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
    const res = await send(t);
    if (res) await voice.speak(res.reply);
  };

  const toggleFloating = () => {
    if (!features.floatingMode) {
      setToast("El modo flotante es de Pro, hermano.");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    void updateProfile({ floating_mode_enabled: !profile?.floating_mode_enabled });
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 6 ? "¿Todavía despierto" : h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
  }, []);

  const pillText =
    voice.mode === "listening" ? pill || "Te escucho…" : thinking ? (voice.transcript ? `«${voice.transcript}»` : "Pensando…") : pill;

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col">
      <header className="flex items-center justify-between py-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{assistantName}</h1>
          <SyncBadge />
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleFloating}
            aria-pressed={!!profile?.floating_mode_enabled}
            aria-label="Modo flotante"
            className={`rounded-full border p-2.5 ${profile?.floating_mode_enabled ? "border-arc bg-arc/20 text-arc" : "border-transparent bg-white/5 text-white/70 hover:bg-white/10"}`}
          >
            <PictureInPicture2 className="h-5 w-5" />
          </motion.button>
          <button onClick={() => setHistoryOpen(true)} className="relative rounded-full bg-white/5 p-2.5 text-white/70 hover:bg-white/10" aria-label="Conversación">
            <MessagesSquare className="h-5 w-5" />
            {messages.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-arc" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <p className="text-center text-sm text-white/45">
          {greeting}, {userName}
          {greeting.startsWith("¿") ? "?" : "."}
        </p>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
          <LiquidDot mode={mode} getLevel={voice.getLevel} size={200} onClick={() => voice.activate("button")} ariaLabel={`Hablar con ${assistantName}`} />
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

        <div className="flex items-center gap-5">
          {voice.wakeWanted && !voice.wakeActive ? (
            <button onClick={() => void voice.enableWake()} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70" aria-label="Activar escucha" title="Activar palmadas y palabra de activación">
              <Ear className="h-5 w-5" />
            </button>
          ) : (
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${voice.wakeActive ? "text-arc" : "text-transparent"}`} title="Escuchando palmadas y tu palabra de activación" aria-hidden={!voice.wakeActive}>
              <Ear className="h-5 w-5" />
            </span>
          )}
          <HoldToTalk
            active={voice.mode === "listening"}
            disabled={!profile?.wake_button_enabled}
            onStart={voice.holdStart}
            onEnd={voice.holdEnd}
          />
          <button
            onClick={voice.stop}
            disabled={voice.mode === "idle"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 disabled:opacity-0"
            aria-label="Parar"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 flex items-center gap-2 pr-16">
        <input className="jv-input rounded-full" placeholder="Escríbeme, hermano…" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="send" />
        <button type="submit" disabled={!text.trim() || thinking} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-arc disabled:opacity-40" aria-label="Enviar">
          <SendHorizonal className="h-5 w-5" />
        </button>
      </form>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-navy-700 px-4 py-2 text-sm">
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
