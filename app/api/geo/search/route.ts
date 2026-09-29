import { NextResponse } from "next/server";
import { fetchWithTimeout, NOMINATIM_UA } from "@/lib/http";
import { countryName, findBundledCity, guessTimezone } from "@/lib/geoRegions";

export const dynamic = "force-dynamic";

/** Geocodificación directa (dirección -> lat/lng). ?country=ES&state=..&city=..&address=.. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const country = (p.get("country") ?? "").toUpperCase();
  const state = p.get("state") ?? "";
  const city = p.get("city") ?? "";
  const address = p.get("address") ?? "";
  if (!country || !city) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const q = [address, city, state, countryName(country)].filter(Boolean).join(", ");
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&countrycodes=${country.toLowerCase()}&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": NOMINATIM_UA }, timeoutMs: 6000 },
    );
    if (res.ok) {
      const [hit] = await res.json();
      if (hit) {
        const lat = parseFloat(hit.lat);
        const lng = parseFloat(hit.lon);
        return NextResponse.json({
          place: { lat, lng, formatted_address: hit.display_name, country: countryName(country), state, city, timezone: guessTimezone(country, lat, lng) },
          source: "nominatim",
          approximate: false,
        });
      }
    }
  } catch {
    /* respaldo */
  }
  const c = findBundledCity(country, state || null, city);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    place: { ...c, formatted_address: q, country: countryName(country), state, city, timezone: guessTimezone(country, c.lat, c.lng) },
    source: "offline",
    approximate: true,
  });
}
