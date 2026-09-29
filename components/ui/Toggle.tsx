"use client";

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-[30px] w-[50px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-200 disabled:opacity-40 ${
        checked ? "bg-arc" : "bg-white/15"
      }`}
    >
      <span
        className={`block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}
