import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

// Letra serif del saludo en el estilo Constelación (se sirve desde el propio dominio).
const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-serif", display: "swap" });

/** Aplica el estilo guardado antes de pintar (sin parpadeo del estilo por defecto). */
const STYLE_BOOT = `try{var s=localStorage.getItem("jarvis.style");if(s==="constelacion"||s==="pulso")document.documentElement.dataset.style=s}catch(e){}`;

export const metadata: Metadata = {
  title: "J.A.R.V.I.S.",
  description: "Tu hermano mayor. Protector, leal y siempre contigo.",
  manifest: "/manifest.json",
  applicationName: "J.A.R.V.I.S.",
  appleWebApp: { capable: true, title: "J.A.R.V.I.S.", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A192F",
  width: "device-width",
  initialScale: 1,
  // Se permite ampliar con los dedos (accesibilidad). Los campos usan 16 px para que iOS no haga zoom solo.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={serif.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STYLE_BOOT }} />
      </head>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
