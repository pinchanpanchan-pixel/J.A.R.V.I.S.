import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/http";
import { isShortMapsLink, parseMapsLink } from "@/lib/geo";

export const dynamic = "force-dynamic";

const ALLOWED = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)$/i;

/** Expande enlaces cortos de Google Maps (solo dominios de Google: evita SSRF). */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  const direct = parseMapsLink(raw);
  if (direct) return NextResponse.json({ coords: direct, url: raw });
  if (!isShortMapsLink(raw)) return NextResponse.json({ error: "unsupported_link" }, { status: 400 });

  let current = raw;
  try {
    for (let i = 0; i < 5; i++) {
      const host = new URL(current).hostname;
      if (!ALLOWED.test(host)) return NextResponse.json({ error: "unsupported_link" }, { status: 400 });
      const res = await fetchWithTimeout(current, { redirect: "manual", timeoutMs: 6000 });
      const loc = res.headers.get("location");
      if (!loc) {
        // A veces la URL final va dentro del HTML
        const body = res.ok ? await res.text() : "";
        const coords = parseMapsLink(current) ?? parseMapsLink(body.match(/https:\/\/www\.google\.[^"'\s]+\/maps[^"'\s]*/)?.[0] ?? "");
        return coords ? NextResponse.json({ coords, url: current }) : NextResponse.json({ error: "no_coords" }, { status: 422 });
      }
      current = new URL(loc, current).toString();
      const coords = parseMapsLink(current);
      if (coords) return NextResponse.json({ coords, url: current });
    }
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
  return NextResponse.json({ error: "no_coords" }, { status: 422 });
}
