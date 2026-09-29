"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock, Play, Square } from "lucide-react";
import { VOICES } from "@/lib/voices";
import { previewVoice, stopSpeaking } from "@/services/tts";
import type { VoiceKey } from "@/types/db";

/** 4 tarjetas de voz (2x2) con botón de reproducir y anillo de selección. */
export function VoiceSelector({
  value,
  onChange,
  maxVoices = 4,
  premium = true,
}: {
  value: VoiceKey;
  onChange: (v: VoiceKey) => void;
  /** Plan Free: solo 1 voz. */
  maxVoices?: number;
  /** Voces premium (ElevenLabs) disponibles en el plan. */
  premium?: boolean;
}) {
  const [playing, setPlaying] = useState<VoiceKey | null>(null);

  const play = async (key: VoiceKey) => {
    if (playing === key) {
      stopSpeaking();
      setPlaying(null);
      return;
    }
    setPlaying(key);
    try {
      await previewVoice(key, premium);
    } finally {
      setPlaying((p) => (p === key ? null : p));
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {VOICES.map((v, i) => {
        const selected = value === v.key;
        const locked = i >= maxVoices;
        return (
          <motion.div
            key={v.key}
            role="radio"
            aria-checked={selected}
            aria-disabled={locked}
            tabIndex={0}
            whileTap={{ scale: locked ? 1 : 0.97 }}
            onClick={() => !locked && onChange(v.key)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !locked && onChange(v.key)}
            className={`relative flex cursor-pointer flex-col gap-3 rounded-3xl border p-4 transition ${
              selected ? "border-transparent bg-white/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
            } ${locked ? "cursor-not-allowed opacity-45" : ""}`}
            style={selected ? { boxShadow: `0 0 0 2px ${v.accent}, 0 8px 30px ${v.accent}33` } : undefined}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void play(v.key);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-navy-900"
                style={{ background: v.accent }}
                aria-label={`Escuchar ${v.name}`}
              >
                {playing === v.key ? <Square className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </button>
              {selected && <Check className="h-5 w-5" style={{ color: v.accent }} />}
              {locked && <Lock className="h-4 w-4 text-white/60" />}
            </div>
            <div>
              <div className="text-[15px] font-semibold leading-tight">{v.name}</div>
              <div className="mt-1 text-xs leading-snug text-white/55">{v.description}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
