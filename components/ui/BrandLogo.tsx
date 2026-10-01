import type { ReactNode } from "react";
import {
  siGmail,
  siGooglecalendar,
  siGoogledocs,
  siGoogledrive,
  siGooglehome,
  siGooglemaps,
  siGooglesheets,
  siGoogleslides,
  siNotion,
  siPhilipshue,
  siSpotify,
  siStrava,
  siTodoist,
  siWhatsapp,
  siYoutube,
  type SimpleIcon,
} from "simple-icons";
import type { ConnectorMeta } from "@/connectors/types";

/** Logos oficiales (Simple Icons, CC0) cuando existen. */
const SIMPLE: Record<string, SimpleIcon> = {
  google_calendar: siGooglecalendar,
  gmail: siGmail,
  google_drive: siGoogledrive,
  google_docs: siGoogledocs,
  google_sheets: siGooglesheets,
  google_slides: siGoogleslides,
  youtube: siYoutube,
  google_maps: siGooglemaps,
  spotify: siSpotify,
  notion: siNotion,
  todoist: siTodoist,
  strava: siStrava,
  whatsapp_import: siWhatsapp,
  hue: siPhilipshue,
  google_home: siGooglehome,
};

/** Iconos dibujados (las marcas que Simple Icons no incluye y las apps de Apple). viewBox 0 0 24 24. */
const DRAWN: Record<string, { bg: string; fg?: string; svg: ReactNode }> = {
  canva: {
    bg: "linear-gradient(135deg,#00C4CC,#7D2AE8)",
    svg: <path fill="#fff" d="M15.6 15.2c-.9 1.2-2.4 2.3-4.3 2.3-2.9 0-4.6-2.4-4.6-5.3 0-3.6 2.6-6.6 5.5-6.6 1.5 0 2.4.8 2.4 1.9 0 1-.7 1.6-1.4 1.6-.5 0-.8-.3-.8-.3s.4-.4.4-1c0-.5-.3-.8-.8-.8-1.4 0-3 2.2-3 4.9 0 2 1 3.4 2.6 3.4 1.3 0 2.5-.8 3.4-1.9.3-.3.8 0 .6.4z" />,
  },
  outlook: {
    bg: "linear-gradient(135deg,#1490DF,#0A62B5)",
    svg: (
      <>
        <rect x="3" y="6" width="11" height="12" rx="1.5" fill="#fff" />
        <ellipse cx="8.5" cy="12" rx="2.6" ry="3.2" fill="none" stroke="#0A62B5" strokeWidth="1.8" />
        <path d="M15 8h6v8h-6z" fill="#fff" opacity=".7" />
      </>
    ),
  },
  onedrive: {
    bg: "linear-gradient(135deg,#0F78D4,#094AB2)",
    svg: <path fill="#fff" d="M9.6 9.2a5 5 0 0 1 9.2 1.9A3.6 3.6 0 0 1 18.4 18H6.8a3.8 3.8 0 0 1-.6-7.6 4.6 4.6 0 0 1 3.4-1.2z" />,
  },
  govee: {
    bg: "#111827",
    svg: <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" d="M17 8.5A6 6 0 1 0 18 13h-5" />,
  },
  tuya: {
    bg: "#FF4800",
    svg: <path fill="#fff" d="M6 7h12v2.6h-4.6V18h-2.8V9.6H6z" />,
  },
  alexa: {
    bg: "#00CAFF",
    svg: <path fill="#fff" d="M12 4a8 8 0 0 0-6.9 12l-.9 3.6 3.6-1A8 8 0 1 0 12 4zm0 3.2a4.8 4.8 0 0 1 0 9.6 4.8 4.8 0 0 1-2.4-.6l-.2-.1V12a2.6 2.6 0 1 1 1.6 2.4V12a1 1 0 1 0 1-1 4.8 4.8 0 0 1 0-3.8z" />,
  },
  apple_calendar: {
    bg: "#fff",
    svg: (
      <>
        <text x="12" y="8.6" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#FF3B30" fontFamily="-apple-system,Helvetica,Arial">
          LUN
        </text>
        <text x="12" y="19" textAnchor="middle" fontSize="10.5" fontWeight="300" fill="#111" fontFamily="-apple-system,Helvetica,Arial">
          7
        </text>
      </>
    ),
  },
  apple_reminders: {
    bg: "#fff",
    svg: (
      <>
        {[
          ["#007AFF", 7],
          ["#FF3B30", 12],
          ["#FF9500", 17],
        ].map(([c, y]) => (
          <g key={String(y)}>
            <circle cx="6.5" cy={y} r="1.7" fill="none" stroke={String(c)} strokeWidth="1.3" />
            <rect x="10" y={Number(y) - 0.6} width="9" height="1.2" rx=".6" fill="#C7C7CC" />
          </g>
        ))}
      </>
    ),
  },
  apple_notes: {
    bg: "#fff",
    svg: (
      <>
        <rect x="0" y="0" width="24" height="7" fill="#FFD60A" />
        {[11, 14.5, 18].map((y) => (
          <rect key={y} x="4" y={y} width="16" height=".8" fill="#D1D1D6" />
        ))}
      </>
    ),
  },
  apple_contacts: {
    bg: "linear-gradient(180deg,#B8B8BD,#8E8E93)",
    svg: (
      <>
        <circle cx="12" cy="9.3" r="3.6" fill="#fff" />
        <path d="M5.5 19.5c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5z" fill="#fff" />
      </>
    ),
  },
  photos: {
    bg: "#fff",
    svg: (
      <>
        {["#FF9500", "#FFCC00", "#34C759", "#5AC8FA", "#007AFF", "#AF52DE", "#FF2D55", "#FF3B30"].map((c, i) => (
          <ellipse key={c} cx="12" cy="7.4" rx="2.4" ry="4.6" fill={c} opacity=".85" transform={`rotate(${i * 45} 12 12)`} />
        ))}
      </>
    ),
  },
};

/** Fondo claro para logos oscuros (Notion) y de color para el resto. */
const LIGHT_BG = new Set(["notion", "hue"]);

/** Logo de cada integración, con el aspecto de un icono de app. */
export function BrandLogo({ meta, size = 40 }: { meta: Pick<ConnectorMeta, "id" | "name" | "color" | "glyph">; size?: number }) {
  const radius = Math.round(size * 0.26);
  const simple = SIMPLE[meta.id];
  const drawn = DRAWN[meta.id];
  if (simple) {
    const light = LIGHT_BG.has(meta.id);
    return (
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ width: size, height: size, borderRadius: radius, background: light ? "#fff" : "rgba(255,255,255,0.96)" }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6}>
          <path d={simple.path} fill={`#${simple.hex === "FFFFFF" ? "000000" : simple.hex}`} />
        </svg>
      </div>
    );
  }
  if (drawn) {
    return (
      <div className="flex shrink-0 items-center justify-center overflow-hidden" style={{ width: size, height: size, borderRadius: radius, background: drawn.bg }} aria-hidden>
        <svg viewBox="0 0 24 24" width={size} height={size}>
          {drawn.svg}
        </svg>
      </div>
    );
  }
  const light = ["#FFFFFF", "#FFCC00"].includes(meta.color.toUpperCase());
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold"
      style={{ width: size, height: size, borderRadius: radius, background: meta.color, color: light ? "#0A192F" : "#fff", fontSize: size * (meta.glyph.length > 1 ? 0.36 : 0.48) }}
      aria-hidden
    >
      {meta.glyph || meta.name[0]}
    </div>
  );
}
