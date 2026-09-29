import type { ConnectorMeta } from "@/connectors/types";

/** Logo simplificado de cada integración (monograma con el color de la marca). */
export function BrandLogo({ meta, size = 40 }: { meta: ConnectorMeta; size?: number }) {
  const light = ["#FFFFFF", "#FFCC00"].includes(meta.color.toUpperCase());
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[12px] font-bold"
      style={{
        width: size,
        height: size,
        background: light ? meta.color : `${meta.color}`,
        color: light ? "#0A192F" : "#fff",
        fontSize: size * (meta.glyph.length > 1 ? 0.36 : 0.48),
        boxShadow: `0 6px 18px ${meta.color}33`,
      }}
      aria-hidden
    >
      {meta.glyph || meta.name[0]}
    </div>
  );
}
