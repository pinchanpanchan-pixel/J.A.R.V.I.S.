"use client";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";

/** Gran botón rojo central: mantener pulsado para hablar. */
export function HoldToTalk({
  active,
  level = 0,
  disabled,
  onStart,
  onEnd,
}: {
  active: boolean;
  level?: number;
  disabled?: boolean;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label="Mantén pulsado para hablar"
      aria-pressed={active}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onStart();
      }}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat && !active) onStart();
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") onEnd();
      }}
      animate={{ scale: active ? 1.12 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="relative flex h-[84px] w-[84px] touch-none items-center justify-center rounded-full bg-alert text-white shadow-[0_12px_40px_rgba(255,59,48,.45)] disabled:opacity-40"
      style={{ WebkitTouchCallout: "none" }}
    >
      {active && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-alert"
          animate={{ scale: 1.3 + level * 0.6, opacity: [0.8, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
      <Mic className="h-9 w-9" />
    </motion.button>
  );
}
