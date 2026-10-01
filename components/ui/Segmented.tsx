"use client";
import { motion } from "framer-motion";
import { GLASS } from "@/components/BottomNav";

/** Control segmentado en cápsula de cristal: la opción activa lleva una píldora más clara y texto de acento. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className={`flex rounded-full p-1 ${GLASS}`} role="tablist" id={id}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-nogrow
            onClick={() => onChange(o.value)}
            className={`relative flex-1 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors duration-200 ${
              active ? "text-arc" : "text-white/55 hover:text-white/85"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-pill-${id}`}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className="absolute inset-0 rounded-full bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
