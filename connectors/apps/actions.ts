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

// ---------------------------------------------------------------------------
// v2: más apps. Sin token devuelven { connected: false } (la skill te dice cómo conectarla).
// ---------------------------------------------------------------------------
type Fetch = typeof fetch;
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const MIME: Record<string, string> = {
  google_docs: "application/vnd.google-apps.document",
  google_sheets: "application/vnd.google-apps.spreadsheet",
  google_slides: "application/vnd.google-apps.presentation",
};

export interface FoundFile {
  name: string;
  url: string;
  modified: string | null;
}

/** Drive, Docs, Sheets y Slides: busca por nombre o contenido. */
export async function googleFileSearch(token: string | null, provider: string, query: string, f: Fetch = fetch): Promise<{ connected: boolean; files: FoundFile[] }> {
  if (!token) return { connected: false, files: [] };
  const safe = query.replace(/['\\]/g, " ").trim();
  const parts = [`(name contains '${safe}' or fullText contains '${safe}')`, "trashed = false"];
  if (MIME[provider]) parts.push(`mimeType = '${MIME[provider]}'`);
  const q = new URLSearchParams({ q: parts.join(" and "), pageSize: "5", orderBy: "modifiedTime desc", fields: "files(name,webViewLink,modifiedTime)" });
  const res = await f(`https://www.googleapis.com/drive/v3/files?${q}`, { headers: bearer(token) });
  if (!res.ok) throw new Error(`drive_${res.status}`);
  const j = (await res.json()) as { files?: Array<{ name: string; webViewLink: string; modifiedTime?: string }> };
  return { connected: true, files: (j.files ?? []).map((x) => ({ name: x.name, url: x.webViewLink, modified: x.modifiedTime ?? null })) };
}

export async function onedriveSearch(token: string | null, query: string, f: Fetch = fetch): Promise<{ connected: boolean; files: FoundFile[] }> {
  if (!token) return { connected: false, files: [] };
  const res = await f(`https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query.replace(/'/g, "''"))}')?$top=5&$select=name,webUrl,lastModifiedDateTime`, { headers: bearer(token) });
  if (!res.ok) throw new Error(`onedrive_${res.status}`);
  const j = (await res.json()) as { value?: Array<{ name: string; webUrl: string; lastModifiedDateTime?: string }> };
  return { connected: true, files: (j.value ?? []).map((x) => ({ name: x.name, url: x.webUrl, modified: x.lastModifiedDateTime ?? null })) };
}

export async function canvaDesigns(token: string | null, query: string, f: Fetch = fetch): Promise<{ connected: boolean; files: FoundFile[] }> {
  if (!token) return { connected: false, files: [] };
  const res = await f(`https://api.canva.com/rest/v1/designs?${new URLSearchParams({ query, ownership: "any", sort_by: "modified_descending" })}`, { headers: bearer(token) });
  if (!res.ok) throw new Error(`canva_${res.status}`);
  const j = (await res.json()) as { items?: Array<{ title?: string; urls?: { view_url?: string; edit_url?: string }; updated_at?: number }> };
  return {
    connected: true,
    files: (j.items ?? []).slice(0, 5).map((d) => ({ name: d.title || "(sin título)", url: d.urls?.view_url ?? d.urls?.edit_url ?? "https://www.canva.com", modified: d.updated_at ? new Date(d.updated_at * 1000).toISOString() : null })),
  };
}

export async function outlookUnread(token: string | null, f: Fetch = fetch): Promise<{ connected: boolean; emails: Array<{ from: string; subject: string }> }> {
  if (!token) return { connected: false, emails: [] };
  const q = new URLSearchParams({ $filter: "isRead eq false", $top: "10", $select: "subject,from", $orderby: "receivedDateTime desc" });
  const res = await f(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${q}`, { headers: bearer(token) });
  if (!res.ok) throw new Error(`outlook_${res.status}`);
  const j = (await res.json()) as { value?: Array<{ subject?: string; from?: { emailAddress?: { name?: string; address?: string } } }> };
  return { connected: true, emails: (j.value ?? []).map((m) => ({ from: m.from?.emailAddress?.name ?? m.from?.emailAddress?.address ?? "", subject: m.subject ?? "(sin asunto)" })) };
}

export async function todoistTasks(token: string | null, f: Fetch = fetch): Promise<{ connected: boolean; tasks: Array<{ content: string; due: string | null; overdue: boolean }> }> {
  if (!token) return { connected: false, tasks: [] };
  const res = await f(`https://api.todoist.com/rest/v2/tasks?${new URLSearchParams({ filter: "today | overdue" })}`, { headers: bearer(token) });
  if (!res.ok) throw new Error(`todoist_${res.status}`);
  const today = new Date().toISOString().slice(0, 10);
  const j = (await res.json()) as Array<{ content: string; due?: { date?: string; string?: string } | null }>;
  return { connected: true, tasks: j.slice(0, 20).map((t) => ({ content: t.content, due: t.due?.string ?? null, overdue: !!t.due?.date && t.due.date.slice(0, 10) < today })) };
}

export async function todoistAdd(token: string | null, content: string, dueString?: string, f: Fetch = fetch): Promise<{ connected: boolean; ok: boolean }> {
  if (!token) return { connected: false, ok: false };
  const res = await f("https://api.todoist.com/rest/v2/tasks", {
    method: "POST",
    headers: { ...bearer(token), "content-type": "application/json" },
    body: JSON.stringify({ content, ...(dueString ? { due_string: dueString, due_lang: "es" } : {}) }),
  });
  return { connected: true, ok: res.ok };
}

export async function stravaRecent(token: string | null, f: Fetch = fetch): Promise<{ connected: boolean; activities: Array<{ name: string; type: string; km: number; minutes: number; date: string }> }> {
  if (!token) return { connected: false, activities: [] };
  const res = await f("https://www.strava.com/api/v3/athlete/activities?per_page=5", { headers: bearer(token) });
  if (!res.ok) throw new Error(`strava_${res.status}`);
  const j = (await res.json()) as Array<{ name: string; sport_type?: string; type?: string; distance: number; moving_time: number; start_date_local: string }>;
  return {
    connected: true,
    activities: j.map((a) => ({ name: a.name, type: a.sport_type ?? a.type ?? "", km: Math.round(a.distance / 100) / 10, minutes: Math.round(a.moving_time / 60), date: a.start_date_local })),
  };
}

/** YouTube: primer vídeo que encaja (con la cuenta), o la página de resultados (sin ella). */
export async function youtubeFind(token: string | null, query: string, f: Fetch = fetch): Promise<{ url: string; title: string | null }> {
  const fallback = { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, title: null };
  if (!token) return fallback;
  const res = await f(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ part: "snippet", q: query, type: "video", maxResults: "1" })}`, { headers: bearer(token) });
  if (!res.ok) return fallback;
  const j = (await res.json()) as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }> };
  const v = j.items?.[0];
  return v?.id?.videoId ? { url: `https://www.youtube.com/watch?v=${v.id.videoId}`, title: v.snippet?.title ?? null } : fallback;
}
