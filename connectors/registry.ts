import type { ConnectorMeta } from "./types";

/** Conectores de apps (Paso 3 del onboarding y Ajustes → Conexiones). */
export const APP_CONNECTORS: ConnectorMeta[] = [
  { id: "notion", name: "Notion", kind: "app", auth: "oauth", color: "#FFFFFF", glyph: "N", description: "Páginas y bases de datos" },
  { id: "google_calendar", name: "Google Calendar", kind: "app", auth: "oauth", color: "#4285F4", glyph: "31", description: "Tus eventos", scopes: ["https://www.googleapis.com/auth/calendar"] },
  { id: "apple_calendar", name: "Apple Calendar", kind: "app", auth: "ios_shortcut", color: "#FF3B30", glyph: "▦", description: "Eventos vía Atajos", note: "Se conecta con un Atajo de iOS." },
  { id: "apple_reminders", name: "Apple Reminders", kind: "app", auth: "ios_shortcut", color: "#FF9500", glyph: "☑", description: "Recordatorios vía Atajos", note: "Se conecta con un Atajo de iOS." },
  { id: "apple_notes", name: "Apple Notes", kind: "app", auth: "ios_shortcut", color: "#FFCC00", glyph: "✎", description: "Notas vía Atajos", note: "Se conecta con un Atajo de iOS." },
  { id: "apple_contacts", name: "Apple Contacts", kind: "app", auth: "ios_shortcut", color: "#8E8E93", glyph: "☺", description: "Contactos vía Atajos", note: "Se conecta con un Atajo de iOS." },
  { id: "apple_passwords", name: "Apple Passwords", kind: "app", auth: "native_only", color: "#34C759", glyph: "⚿", description: "Solo con la app nativa", note: "iOS no permite a ninguna web leer tus contraseñas. Llegará con la app nativa." },
  { id: "spotify", name: "Spotify", kind: "app", auth: "oauth", color: "#1DB954", glyph: "♫", description: "Tu música", scopes: ["user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"] },
  { id: "gmail", name: "Gmail", kind: "app", auth: "oauth", color: "#EA4335", glyph: "M", description: "Correo", scopes: ["https://www.googleapis.com/auth/gmail.readonly"] },
  { id: "google_drive", name: "Google Drive", kind: "app", auth: "oauth", color: "#0F9D58", glyph: "▲", description: "Archivos", scopes: ["https://www.googleapis.com/auth/drive.readonly"] },
  { id: "photos", name: "Fotos", kind: "app", auth: "import", color: "#FF2D55", glyph: "✿", description: "Memoria visual con tus fotos" },
  { id: "whatsapp_import", name: "WhatsApp Import", kind: "app", auth: "import", color: "#25D366", glyph: "✆", description: "Importa tus chats (.zip)" },
];

/** Conectores del hogar (Paso 4 y pestaña Hogar). */
export const HOME_CONNECTORS: ConnectorMeta[] = [
  { id: "govee", name: "Govee", kind: "home", auth: "api_key", color: "#FF6B35", glyph: "G", description: "Luces y tiras LED" },
  { id: "alexa", name: "Alexa", kind: "home", auth: "oauth", color: "#00CAFF", glyph: "a", description: "Dispositivos Alexa" },
  { id: "homekit", name: "HomeKit", kind: "home", auth: "ios_shortcut", color: "#FF9F0A", glyph: "⌂", description: "Escenas vía Atajos", note: "HomeKit solo es accesible desde apps nativas; hasta entonces, escenas con Atajos de iOS." },
  { id: "google_home", name: "Google Home", kind: "home", auth: "oauth", color: "#4285F4", glyph: "G", description: "Dispositivos Google" },
  { id: "hue", name: "Philips Hue", kind: "home", auth: "oauth", color: "#FFFFFF", glyph: "h", description: "Luces Hue" },
  { id: "tuya", name: "Tuya / Smart Life", kind: "home", auth: "api_key", color: "#FF4800", glyph: "T", description: "Enchufes, aires, luces" },
];

export const ALL_CONNECTORS = [...APP_CONNECTORS, ...HOME_CONNECTORS];
export const connectorById = (id: string) => ALL_CONNECTORS.find((c) => c.id === id);
