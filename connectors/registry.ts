import type { ConnectorMeta } from "./types";

const G = (s: string) => `https://www.googleapis.com/auth/${s}`;
/** Identidad (para «Conectado como …»). */
const GOOGLE_ID = ["openid", "email"];

/** Conectores de apps (configuración inicial 3/8 y Ajustes → Conexiones). */
export const APP_CONNECTORS: ConnectorMeta[] = [
  // --- Google (una sola cuenta de Google; cada app pide solo su permiso)
  { id: "google_calendar", name: "Google Calendar", kind: "app", auth: "oauth", account: "google", color: "#4285F4", glyph: "31", description: "Te digo qué tienes hoy y mañana, y te aviso antes de cada cita.", scopes: [...GOOGLE_ID, G("calendar")], keywords: ["agenda", "calendario", "eventos"] },
  { id: "gmail", name: "Gmail", kind: "app", auth: "oauth", account: "google", color: "#EA4335", glyph: "M", description: "Te leo los correos sin leer y te resumo lo importante.", scopes: [...GOOGLE_ID, G("gmail.readonly")], keywords: ["correo", "email", "mail"] },
  { id: "google_drive", name: "Google Drive", kind: "app", auth: "oauth", account: "google", color: "#0F9D58", glyph: "▲", description: "Busco tus archivos por nombre o contenido.", scopes: [...GOOGLE_ID, G("drive.readonly")], keywords: ["archivos", "drive"] },
  { id: "google_docs", name: "Google Docs", kind: "app", auth: "oauth", account: "google", color: "#4285F4", glyph: "D", description: "Leo tus documentos para responderte sobre ellos.", scopes: [...GOOGLE_ID, G("documents.readonly"), G("drive.metadata.readonly")], keywords: ["documentos", "texto"] },
  { id: "google_sheets", name: "Google Sheets", kind: "app", auth: "oauth", account: "google", color: "#0F9D58", glyph: "S", description: "Consulto tus hojas de cálculo (gastos, listas…).", scopes: [...GOOGLE_ID, G("spreadsheets.readonly"), G("drive.metadata.readonly")], keywords: ["hojas de cálculo", "excel", "tablas"] },
  { id: "google_slides", name: "Google Slides", kind: "app", auth: "oauth", account: "google", color: "#F4B400", glyph: "P", description: "Encuentro tus presentaciones y te cuento de qué van.", scopes: [...GOOGLE_ID, G("presentations.readonly"), G("drive.metadata.readonly")], keywords: ["presentaciones", "diapositivas"] },
  { id: "youtube", name: "YouTube", kind: "app", auth: "oauth", account: "google", color: "#FF0000", glyph: "▶", description: "Busco vídeos y te pongo lo que me pidas.", scopes: [...GOOGLE_ID, G("youtube.readonly")], keywords: ["vídeos", "videos"] },
  { id: "google_maps", name: "Google Maps", kind: "app", auth: "link", color: "#34A853", glyph: "⌖", description: "«Llévame a…»: te abro la ruta en Google Maps. No hace falta iniciar sesión.", keywords: ["mapas", "rutas", "direcciones"] },
  // --- Otras apps
  { id: "spotify", name: "Spotify", kind: "app", auth: "oauth", color: "#1DB954", glyph: "♫", description: "«Pon mi música»: play, pausa y siguiente en tu Spotify.", scopes: ["user-read-email", "user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"], keywords: ["música", "musica", "canciones"] },
  { id: "notion", name: "Notion", kind: "app", auth: "oauth", color: "#FFFFFF", glyph: "N", description: "Busco en tus páginas y bases de datos.", keywords: ["notas", "wiki"] },
  { id: "canva", name: "Canva", kind: "app", auth: "oauth", color: "#00C4CC", glyph: "C", description: "Encuentro tus diseños y te los abro.", scopes: ["design:meta:read", "profile:read"], keywords: ["diseño", "diseños"] },
  { id: "todoist", name: "Todoist", kind: "app", auth: "oauth", color: "#E44332", glyph: "✓", description: "Te digo tus tareas de hoy y apunto las nuevas.", scopes: ["data:read_write"], keywords: ["tareas", "pendientes", "to do"] },
  { id: "strava", name: "Strava", kind: "app", auth: "oauth", color: "#FC4C02", glyph: "S", description: "Te cuento tus últimos entrenos y cómo vas.", scopes: ["read", "activity:read_all"], keywords: ["deporte", "correr", "bici", "entrenos"] },
  // --- Microsoft (una cuenta)
  { id: "outlook", name: "Outlook", kind: "app", auth: "oauth", account: "microsoft", color: "#0078D4", glyph: "O", description: "Te leo el correo y la agenda de Outlook.", scopes: ["openid", "email", "offline_access", "User.Read", "Mail.Read", "Calendars.Read"], keywords: ["microsoft", "correo", "hotmail"] },
  { id: "onedrive", name: "OneDrive", kind: "app", auth: "oauth", account: "microsoft", color: "#0364B8", glyph: "☁", description: "Busco tus archivos de OneDrive.", scopes: ["openid", "email", "offline_access", "User.Read", "Files.Read"], keywords: ["microsoft", "archivos"] },
  // --- Apple (vía Atajo de iOS)
  { id: "apple_calendar", name: "Calendario", kind: "app", auth: "ios_shortcut", color: "#FF3B30", glyph: "▦", description: "Tus eventos del Calendario del iPhone, para que te los recuerde.", keywords: ["apple", "agenda", "calendar"] },
  { id: "apple_reminders", name: "Recordatorios", kind: "app", auth: "ios_shortcut", color: "#FF9500", glyph: "☑", description: "Tus recordatorios del iPhone, para avisarte a tiempo.", keywords: ["apple", "tareas", "reminders"] },
  { id: "apple_notes", name: "Notas", kind: "app", auth: "ios_shortcut", color: "#FFCC00", glyph: "✎", description: "Tus notas del iPhone pasan a mi memoria.", keywords: ["apple", "notes"] },
  { id: "apple_contacts", name: "Contactos", kind: "app", auth: "ios_shortcut", color: "#8E8E93", glyph: "☺", description: "Tus contactos, para saber de quién me hablas.", keywords: ["apple", "contacts", "teléfonos"] },
  // --- Importar (no es una cuenta)
  { id: "photos", name: "Fotos", kind: "app", auth: "import", color: "#FF2D55", glyph: "✿", description: "Eliges fotos y las recuerdo: qué sale, el texto que aparece, dónde y cuándo. Luego puedes preguntarme por ellas.", keywords: ["imágenes", "galería", "memoria visual"] },
  { id: "whatsapp_import", name: "WhatsApp", kind: "app", auth: "import", color: "#25D366", glyph: "✆", description: "Importa un chat exportado (.zip) y recordaré lo que hablasteis, con sus fechas.", keywords: ["chats", "mensajes", "importar"] },
];

/** Conectores del hogar (configuración inicial 4/8 y pestaña Hogar). */
export const HOME_CONNECTORS: ConnectorMeta[] = [
  { id: "hue", name: "Philips Hue", kind: "home", auth: "oauth", color: "#FFFFFF", glyph: "h", description: "Enciende, apaga, regula y cambia el color de tus luces Hue.", scopes: [], keywords: ["luces", "bombillas"] },
  {
    id: "govee",
    name: "Govee",
    kind: "home",
    auth: "api_key",
    color: "#2F6BFF",
    glyph: "G",
    description: "Luces y tiras LED Govee: encender, brillo y color.",
    keywords: ["luces", "tiras led"],
    keyFields: [{ id: "api_key", label: "Clave de la API de Govee", placeholder: "xxxxxxxx-xxxx-…", secret: true }],
    keyHelp: "En la app Govee Home: Perfil → Ajustes (⚙) → «Apply for API Key». Te llega por correo en unos minutos.",
  },
  {
    id: "tuya",
    name: "Tuya / Smart Life",
    kind: "home",
    auth: "api_key",
    color: "#FF4800",
    glyph: "T",
    description: "Enchufes, luces y aires de Smart Life o Tuya: encender y apagar.",
    keywords: ["smart life", "enchufes", "aire"],
    keyFields: [
      { id: "access_id", label: "Access ID", placeholder: "Access ID / Client ID" },
      { id: "access_secret", label: "Access Secret", secret: true },
      { id: "uid", label: "UID de tu cuenta de Smart Life", placeholder: "eu1234…" },
      {
        id: "region",
        label: "Región",
        options: [
          { value: "eu", label: "Europa" },
          { value: "us", label: "América" },
          { value: "in", label: "India" },
          { value: "cn", label: "China" },
        ],
      },
    ],
    keyHelp:
      "En iot.tuya.com crea un proyecto Cloud (región de tu cuenta), vincula tu app Smart Life en «Devices → Link App Account» y copia Access ID, Access Secret y el UID de la cuenta vinculada.",
  },
  {
    id: "alexa",
    name: "Amazon Alexa",
    kind: "home",
    auth: "unavailable",
    color: "#00CAFF",
    glyph: "a",
    description: "Amazon todavía no deja que una app web controle tus dispositivos de Alexa.",
    note: "Si tus luces o enchufes son Philips Hue, Govee o Smart Life, conéctalos aquí directamente y funcionan igual, también con Alexa.",
    keywords: ["amazon", "echo"],
  },
  {
    id: "google_home",
    name: "Google Home",
    kind: "home",
    auth: "unavailable",
    color: "#4285F4",
    glyph: "G",
    description: "Google todavía no deja que una app web controle tus dispositivos de Google Home.",
    note: "Si tus luces o enchufes son Philips Hue, Govee o Smart Life, conéctalos aquí directamente y funcionan igual.",
    keywords: ["nest"],
  },
];

export const ALL_CONNECTORS = [...APP_CONNECTORS, ...HOME_CONNECTORS];
export const connectorById = (id: string) => ALL_CONNECTORS.find((c) => c.id === id);
/** Nombre bonito de un proveedor («google_home» → «Google Home»). */
export const connectorName = (id: string) => connectorById(id)?.name ?? id;
/** Marcas de hogar que se pueden controlar de verdad desde la app. */
export const HOME_COMPATIBLE = HOME_CONNECTORS.filter((c) => c.auth !== "unavailable").map((c) => c.name);
