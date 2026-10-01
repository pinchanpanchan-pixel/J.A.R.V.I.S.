import type { ReactNode } from "react";

export function Section({ id, title, description, children }: { id?: string; title?: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      {title && <h2 className="mb-1 px-1 text-[13px] font-semibold uppercase tracking-wider text-white/45">{title}</h2>}
      {description && <p className="mb-2 px-1 text-xs text-white/40">{description}</p>}
      <div className="jv-card p-4">{children}</div>
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-white/[0.06]">
      <div className="min-w-0">
        <div className="text-[15px] text-white">{label}</div>
        {hint && <div className="text-xs text-white/45">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
