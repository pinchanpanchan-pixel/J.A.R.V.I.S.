/** Tipos de filas de la base de datos (espejo de supabase/migrations). */

export type Plan = "free" | "pro_lite" | "pro" | "founder" | "pro_lifetime";
export type Period = "monthly" | "yearly" | "lifetime";

export interface BaseRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  /** Marca del servidor, solo para el cursor de sincronización. */
  server_updated_at?: string;
}

export interface UserRow extends BaseRow {
  email: string;
  is_owner: boolean;
  subscription: Plan;
  subscription_period: Period | null;
  subscription_status: string;
  subscription_renews_at: string | null;
  stripe_customer_id: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  diary_reminder_time: string | null;
  diary_reminder_label: string | null;
  floating_mode_enabled: boolean;
  wake_clap_enabled: boolean;
  wake_button_enabled: boolean;
  wake_word_enabled: boolean;
  proactive_enabled: boolean;
  morning_brief_enabled: boolean;
  timezone: string | null;
  locale: string | null;
}

export interface UserCoreMemoryRow extends BaseRow {
  user_name: string | null;
  assistant_name: string;
  facts: Array<{ fact: string; at: string }>;
  personality_notes: string | null;
}

export type MemorySource = "voice" | "whatsapp" | "manual" | "vision" | "quick_note" | "diary" | "import" | "chat";

export interface MemoryBlockRow extends BaseRow {
  title: string;
  content: string;
  tags: string[];
  source: MemorySource;
  original_date: string | null;
  metadata: Record<string, unknown>;
}

export interface DiaryEntryRow extends BaseRow {
  entry_date: string;
  content_ciphertext: string | null;
  summary: string | null;
  sentiment: number | null;
  emotions: string[];
  key_events: string[];
  thoughts: string[];
  tags: string[];
  input_mode: "text" | "voice";
  audio_path: string | null;
}

export interface QuickNoteRow extends BaseRow {
  content: string;
  category: string;
  pinned: boolean;
  source: string;
}

export interface WhatsappImportRow extends BaseRow {
  file_name: string;
  chat_name: string | null;
  participants: string[];
  status: "pending" | "parsing" | "saving" | "done" | "error";
  progress: number;
  total_messages: number;
  imported_messages: number;
  media_count: number;
  first_message_at: string | null;
  last_message_at: string | null;
  error: string | null;
}

export interface PhotoRow extends BaseRow {
  storage_path: string | null;
  description: string | null;
  ocr_text: string | null;
  objects: string[];
  faces_count: number;
  exif: Record<string, unknown>;
  lat: number | null;
  lng: number | null;
  taken_at: string | null;
  memory_block_id: string | null;
  status: "pending" | "analyzing" | "done" | "error";
}

export type VoiceKey = "british_original" | "young_brother" | "deep_calm" | "spanish_brother";

export interface VoicePrefsRow extends BaseRow {
  voice_key: VoiceKey;
  rate: number;
  volume: number;
  wake_word: string | null;
  clap_threshold: number;
  /** Huella de la voz del dueño (vector normalizado; nunca el audio). */
  voiceprint: number[] | null;
  voiceprint_threshold: number;
  owner_voice_only: boolean;
}

export interface ConnectorTokenRow extends BaseRow {
  provider: string;
  kind: "app" | "home";
  enabled: boolean;
  status: "disconnected" | "pending" | "connected" | "error" | "mock";
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  expires_at: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  last_synced_at: string | null;
}

export type DeviceType = "light" | "plug" | "ac" | "switch" | "sensor" | "speaker" | "tv";

export interface DeviceState {
  on?: boolean;
  brightness?: number;
  color?: string;
  temperature?: number;
  mode?: string;
  [k: string]: unknown;
}

export interface SmartHomeDeviceRow extends BaseRow {
  provider: string;
  external_id: string;
  name: string;
  room: string | null;
  type: DeviceType;
  state: DeviceState;
  online: boolean;
}

export interface HomeAutomationRow extends BaseRow {
  name: string;
  cron: string;
  timezone: string;
  command: string;
  enabled: boolean;
  last_run_at: string | null;
}

export interface ShortcutRow extends BaseRow {
  trigger_phrase: string;
  action: string;
  params: Record<string, unknown>;
  is_default: boolean;
  enabled: boolean;
}

export interface SubscriptionRow extends BaseRow {
  plan: Plan;
  period: Period;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  provider: "stripe" | "paypal" | "code" | "owner" | "mock";
  provider_subscription_id: string | null;
  discount_code: string | null;
  amount_cents: number;
  currency: string;
  current_period_end: string | null;
}

export interface UserLocationRow extends BaseRow {
  method: "auto" | "manual" | "maps_link";
  lat: number;
  lng: number;
  formatted_address: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address_line: string | null;
  timezone: string | null;
  is_primary: boolean;
}

export interface WorldMonitorSettingsRow extends BaseRow {
  quake_enabled: boolean;
  min_magnitude: number;
  radius_km: number;
  check_interval_minutes: number;
  alert_sound: string;
  weather_enabled: boolean;
  air_quality_enabled: boolean;
  aqi_threshold: number;
  seen_event_ids: string[];
  last_checked_at: string | null;
}

export interface WorldAlertRow extends BaseRow {
  kind: "earthquake" | "weather" | "air_quality";
  severity: "info" | "warning" | "critical";
  external_id: string | null;
  title: string;
  body: string;
  data: Record<string, unknown>;
  acknowledged: boolean;
}

export type AIProvider = "openai" | "anthropic" | "gemini" | "groq" | "openrouter";

export interface AIProviderKeyRow extends BaseRow {
  provider: AIProvider;
  label: string | null;
  key_ciphertext: string;
  key_last4: string;
  enabled: boolean;
  fail_count: number;
  last_error: string | null;
  last_used_at: string | null;
}

export interface ChatMessageRow extends BaseRow {
  role: "user" | "assistant" | "system";
  content: string;
  provider: string | null;
  metadata: Record<string, unknown>;
}

export interface DiscountCodeRow {
  id: string;
  code: string;
  percent_off: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  duration: "once" | "repeating" | "forever" | "lifetime";
  grants_plan: Plan | null;
  grants_period: Period | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountRedemptionRow {
  id: string;
  user_id: string;
  code: string;
  redeemed_at: string;
}

/** Tablas que el motor de sincronización replica entre dispositivos. */
export interface SyncedTables {
  users: UserRow;
  user_core_memory: UserCoreMemoryRow;
  memory_blocks: MemoryBlockRow;
  diary_entries: DiaryEntryRow;
  quick_notes: QuickNoteRow;
  whatsapp_imports: WhatsappImportRow;
  photos: PhotoRow;
  voice_prefs: VoicePrefsRow;
  connectors_tokens: ConnectorTokenRow;
  smart_home_devices: SmartHomeDeviceRow;
  home_automations: HomeAutomationRow;
  shortcuts: ShortcutRow;
  subscriptions: SubscriptionRow;
  user_locations: UserLocationRow;
  world_monitor_settings: WorldMonitorSettingsRow;
  world_alerts: WorldAlertRow;
  ai_provider_keys: AIProviderKeyRow;
  chat_messages: ChatMessageRow;
}

export type TableName = keyof SyncedTables;
export type RowOf<T extends TableName> = SyncedTables[T];

export const SYNCED_TABLES: TableName[] = [
  "users",
  "user_core_memory",
  "memory_blocks",
  "diary_entries",
  "quick_notes",
  "whatsapp_imports",
  "photos",
  "voice_prefs",
  "connectors_tokens",
  "smart_home_devices",
  "home_automations",
  "shortcuts",
  "subscriptions",
  "user_locations",
  "world_monitor_settings",
  "world_alerts",
  "ai_provider_keys",
  "chat_messages",
];

/** Tablas donde el cliente solo lee (las escribe el backend). */
export const READ_ONLY_TABLES: ReadonlySet<TableName> = new Set(["subscriptions"]);

/** Columnas que el cliente nunca envía al servidor (protegidas o generadas). */
export const CLIENT_STRIPPED_COLUMNS: Partial<Record<TableName, string[]>> = {
  users: [
    "user_id",
    "email",
    "is_owner",
    "subscription",
    "subscription_period",
    "subscription_status",
    "subscription_renews_at",
    "stripe_customer_id",
  ],
};
