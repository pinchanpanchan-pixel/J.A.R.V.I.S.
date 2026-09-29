"use client";
import { useEffect, useRef } from "react";
import type { ChatMessageRow } from "@/types/db";

export function ChatHistory({ messages, assistantName }: { messages: ChatMessageRow[]; assistantName: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);
  if (messages.length === 0) return <p className="py-10 text-center text-sm text-white/40">Aún no hemos hablado. Dime algo, hermano.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`selectable max-w-[82%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-[15px] leading-snug ${
              m.role === "user" ? "rounded-br-lg bg-arc text-navy-900" : "rounded-bl-lg bg-white/[0.07] text-white"
            }`}
          >
            {m.role === "assistant" && <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-arc/80">{assistantName}</div>}
            {m.content}
          </div>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
