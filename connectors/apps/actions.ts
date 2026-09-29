import "server-only";

/**
 * Acciones de los conectores de apps. Cada una recibe un token válido o null
 * (null = no conectado / modo simulado → datos de ejemplo claramente marcados).
 */
export interface CalendarEvent {
  title: string;
  start: string;
  end: string | null;
  location: string | null;
}

function dayRange(offsetDays: number, timeZone: string) {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone }));
  const diff = now.getTime() - local.getTime();
  const start = new Date(local.getFullYear(), local.getMonth(), local.getDate() + offsetDays);
  const end = new Date(start.getTime() + 86400000);
  return { start: new Date(start.getTime() + diff), end: new Date(end.getTime() + diff) };
}

export async function calendarEvents(token: string | null, offsetDays: number, timeZone: string): Promise<{ events: CalendarEvent[]; sample: boolean }> {
  const { start, end } = dayRange(offsetDays, timeZone);
  if (!token) {
    const at = (h: number) => new Date(start.getTime() + h * 3600000).toISOString();
    return {
      sample: true,
      events: [
        { title: "Reunión de equipo", start: at(10), end: at(11), location: "Oficina" },
        { title: "Comida con mamá", start: at(14), end: at(15.5), location: null },
        { title: "Gimnasio", start: at(19), end: at(20), location: null },
      ],
    };
  }
  const q = new URLSearchParams({ timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "25" });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`calendar_${res.status}`);
  const j = (await res.json()) as { items?: Array<{ summary?: string; location?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }> };
  return {
    sample: false,
    events: (j.items ?? []).map((e) => ({
      title: e.summary ?? "(sin título)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? null,
      location: e.location ?? null,
    })),
  };
}

export async function gmailUnread(token: string | null): Promise<{ emails: Array<{ from: string; subject: string }>; sample: boolean }> {
  if (!token) {
    return {
      sample: true,
      emails: [
        { from: "Banco", subject: "Tu extracto mensual está disponible" },
        { from: "Laura", subject: "¿Quedamos el sábado?" },
      ],
    };
  }
  const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread%20newer_than%3A2d&maxResults=10", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!list.ok) throw new Error(`gmail_${list.status}`);
  const ids = ((await list.json()) as { messages?: Array<{ id: string }> }).messages ?? [];
  const emails = await Promise.all(
    ids.map(async ({ id }) => {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const m = (await r.json()) as { payload?: { headers?: Array<{ name: string; value: string }> } };
      const h = (n: string) => m.payload?.headers?.find((x) => x.name === n)?.value ?? "";
      return { from: h("From").replace(/<.*>/, "").trim(), subject: h("Subject") };
    }),
  );
  return { sample: false, emails };
}

export type SpotifyAction = "play" | "pause" | "next" | "previous";

export async function spotifyControl(token: string | null, action: SpotifyAction): Promise<{ ok: boolean; sample: boolean; error?: string }> {
  if (!token) return { ok: true, sample: true };
  const map: Record<SpotifyAction, [string, string]> = {
    play: ["PUT", "play"],
    pause: ["PUT", "pause"],
    next: ["POST", "next"],
    previous: ["POST", "previous"],
  };
  const [method, path] = map[action];
  const res = await fetch(`https://api.spotify.com/v1/me/player/${path}`, { method, headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return { ok: false, sample: false, error: "no_active_device" };
  return { ok: res.ok || res.status === 204, sample: false, error: res.ok ? undefined : `spotify_${res.status}` };
}

export async function notionSearch(token: string | null, query: string): Promise<{ pages: Array<{ title: string; url: string }>; sample: boolean }> {
  if (!token) return { sample: true, pages: [{ title: `Notas sobre «${query}» (ejemplo)`, url: "https://notion.so" }] };
  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "notion-version": "2022-06-28", "content-type": "application/json" },
    body: JSON.stringify({ query, page_size: 5 }),
  });
  if (!res.ok) throw new Error(`notion_${res.status}`);
  const j = (await res.json()) as { results?: Array<{ url: string; properties?: Record<string, { title?: Array<{ plain_text: string }> }> }> };
  return {
    sample: false,
    pages: (j.results ?? []).map((r) => ({
      url: r.url,
      title:
        Object.values(r.properties ?? {})
          .find((p) => p.title)
          ?.title?.map((t) => t.plain_text)
          .join("") || "(sin título)",
    })),
  };
}
