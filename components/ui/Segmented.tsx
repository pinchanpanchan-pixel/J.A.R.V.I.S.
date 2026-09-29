"use client";

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
    <div className="flex rounded-2xl bg-white/5 p-1" role="tablist" id={id}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-[13px] font-medium transition-colors duration-200 ${
              active ? "bg-arc text-navy-900 shadow" : "text-white/70 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
