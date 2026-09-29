import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/http";
import { bundledCities, bundledRegions, countryName } from "@/lib/geoRegions";

export const dynamic = "force-dynamic";

/**
 * Cascada de regiones. ?country=CO -> estados/departamentos; ?country=CO&state=Antioquia -> ciudades.
 * Primero datos incluidos; si el país no está, countriesnow.space; si no hay red, lista vacía (texto libre).
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const country = (p.get("country") ?? "").toUpperCase();
  const state = p.get("state");
  if (!/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: "invalid_country" }, { status: 400 });

  if (!state) {
    const local = bundledRegions(country);
    if (local) return NextResponse.json({ items: local, source: "bundled" });
    try {
      const res = await fetchWithTimeout("https://countriesnow.space/api/v0.1/countries/states", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ country: countryName(country, "en") }),
        timeoutMs: 6000,
      });
      const j = await res.json();
      const items: string[] = (j?.data?.states ?? []).map((s: { name: string }) => s.name.replace(/ (Department|Province|State|Region)$/, ""));
      return NextResponse.json({ items, source: "remote" }, { headers: { "cache-control": "public, max-age=86400" } });
    } catch {
      return NextResponse.json({ items: [], source: "none" });
    }
  }

  const local = bundledCities(country, state);
  if (local) return NextResponse.json({ items: local.map((c) => c.name), source: "bundled" });
  try {
    const res = await fetchWithTimeout("https://countriesnow.space/api/v0.1/countries/state/cities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ country: countryName(country, "en"), state }),
      timeoutMs: 6000,
    });
    const j = await res.json();
    return NextResponse.json({ items: (j?.data ?? []) as string[], source: "remote" }, { headers: { "cache-control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ items: [], source: "none" });
  }
}
