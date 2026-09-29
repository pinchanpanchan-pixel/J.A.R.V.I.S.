import { NextResponse } from "next/server";
import { fetchWithTimeout, NOMINATIM_UA } from "@/lib/http";
import { isValidLatLng, type ResolvedPlace } from "@/lib/geo";
import { guessTimezone, nearestBundledPlace } from "@/lib/geoRegions";

export const dynamic = "force-dynamic";

/** Geocodificación inversa: Nominatim (OSM) con respaldo a ciudades incluidas. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  if (!isValidLatLng(lat, lng)) return NextResponse.json({ error: "invalid_coords" }, { status: 400 });

  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": NOMINATIM_UA }, timeoutMs: 6000 },
    );
    if (res.ok) {
      const j = await res.json();
      const a = j.address ?? {};
      const cc = (a.country_code ?? "").toUpperCase();
      const place: ResolvedPlace = {
        lat,
        lng,
        formatted_address: j.display_name ?? null,
        country: a.country ?? null,
        state: a.state ?? a.region ?? a.province ?? null,
        city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null,
        timezone: guessTimezone(cc, lat, lng),
      };
      return NextResponse.json({ place, source: "nominatim" });
    }
  } catch {
    /* sin red: respaldo */
  }
  const fallback = nearestBundledPlace({ lat, lng });
  return NextResponse.json({
    place: fallback ?? { lat, lng, formatted_address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, country: null, state: null, city: null, timezone: null },
    source: "offline",
  });
}
