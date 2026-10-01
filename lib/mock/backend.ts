"use client";
import type { AnyRow } from "@/lib/sync/remote";
import type { MockRemote } from "@/lib/sync/mockRemote";
import { nowIso, stableId } from "@/lib/ids";
import type { EnsureProfileResult } from "@/lib/auth/types";

/**
 * Backend simulado: hace en el navegador lo que en producción hacen el trigger
 * handle_new_auth_user y /api/auth/ensure-profile con service_role.
 */
export async function mockBootstrapUser(cloud: MockRemote, user: { id: string; email: string }) {
  const now = nowIso();
  const base = { user_id: user.id, created_at: now, updated_at: now, deleted_at: null };
  if (!(await cloud.getRow("users", user.id))) {
    await cloud.pushAsBackend("users", {
      ...base,
      id: user.id,
      email: user.email,
      is_owner: false,
      subscription: "free",
      subscription_period: null,
      subscription_status: "active",
      onboarding_step: 1,
      onboarding_completed: false,
      diary_reminder_time: "22:30",
      diary_reminder_label: "Noche",
      floating_mode_enabled: false,
      wake_clap_enabled: false,
      wake_button_enabled: true,
      wake_word_enabled: true,
      proactive_enabled: true,
      morning_brief_enabled: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: "es",
    } as AnyRow);
  }
  if (!(await cloud.getRow("user_core_memory", user.id))) {
    await cloud.pushAsBackend("user_core_memory", {
      ...base,
      id: user.id,
      user_name: null,
      assistant_name: "J.A.R.V.I.S.",
      facts: [],
      personality_notes: null,
    } as AnyRow);
  }
  if (!(await cloud.getRow("voice_prefs", user.id))) {
    await cloud.pushAsBackend("voice_prefs", {
      ...base,
      id: user.id,
      voice_key: "british_original",
      rate: 1,
      volume: 1,
      wake_word: null,
      clap_threshold: 0.35,
      voiceprint: null,
      voiceprint_threshold: 0.82,
      owner_voice_only: false,
    } as AnyRow);
  }
  if (!(await cloud.getRow("world_monitor_settings", user.id))) {
    await cloud.pushAsBackend("world_monitor_settings", {
      ...base,
      id: user.id,
      quake_enabled: true,
      min_magnitude: 4.5,
      radius_km: 500,
      check_interval_minutes: 2,
      alert_sound: "siren",
      weather_enabled: true,
      air_quality_enabled: true,
      aqi_threshold: 4,
      seen_event_ids: [],
      last_checked_at: null,
    } as AnyRow);
  }

  // Estado de propietario calculado en el servidor (OWNER_EMAILS vive en .env).
  const res = await fetch("/api/auth/ensure-profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email }),
  });
  if (!res.ok) return;
  const profile = (await res.json()) as EnsureProfileResult;
  const current = await cloud.getRow("users", user.id);
  if (profile.is_owner && (!current?.is_owner || current.subscription !== "pro_lifetime")) {
    await cloud.pushAsBackend("users", {
      ...(current as AnyRow),
      is_owner: true,
      subscription: "pro_lifetime",
      subscription_period: "lifetime",
      subscription_status: "active",
      updated_at: nowIso(),
    });
    await cloud.pushAsBackend("subscriptions", {
      ...base,
      id: stableId(user.id, "owner-subscription"),
      plan: "pro_lifetime",
      period: "lifetime",
      status: "active",
      provider: "owner",
      provider_subscription_id: null,
      discount_code: null,
      amount_cents: 0,
      currency: "usd",
      current_period_end: null,
    } as AnyRow);
  }
}
