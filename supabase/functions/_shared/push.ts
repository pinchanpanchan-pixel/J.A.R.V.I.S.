// Web Push (VAPID) a todas las suscripciones de un usuario. Borra las caducadas (404/410).
import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

let configured = false;
function setup(): boolean {
  if (configured) return true;
  const pub = Deno.env.get("VAPID_PUBLIC_KEY") ?? Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return false;
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

export async function pushToUser(sb: SupabaseClient, userId: string, payload: PushPayload): Promise<number> {
  if (!setup()) return 0;
  const { data: subs } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).is("deleted_at", null);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: payload.urgent ? "high" : "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return sent;
}
