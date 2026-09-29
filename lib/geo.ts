/** Utilidades de geolocalización (compartidas cliente/servidor). */

export interface LatLng {
  lat: number;
  lng: number;
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";

/**
 * Extrae coordenadas de un enlace de Google Maps. Soporta:
 *  - https://www.google.com/maps/place/.../@40.4168,-3.7038,15z
 *  - https://www.google.com/maps/place/...!3d40.4168!4d-3.7038   (más preciso que @)
 *  - https://maps.google.com/?q=40.4168,-3.7038   | ?ll= | ?query= | ?destination= | ?center=
 *  - https://www.google.com/maps/search/40.4168,+-3.7038
 *  - geo:40.4168,-3.7038
 *  - "40.4168, -3.7038" pegado a pelo
 * Los enlaces cortos (maps.app.goo.gl) se expanden antes en el servidor (/api/geo/expand).
 */
export function parseMapsLink(input: string): LatLng | null {
  if (!input) return null;
  let text = input.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    /* no pasa nada */
  }
  text = text.replace(/\+/g, " ");

  const patterns: RegExp[] = [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`[?&](?:q|ll|query|destination|center|daddr|sll)=(?:loc:)?\\s*${NUM}\\s*,\\s*${NUM}`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`/maps/(?:search|place|dir)/(?:[^/]*/)?\\s*${NUM}\\s*,\\s*${NUM}`),
    new RegExp(`^geo:${NUM},${NUM}`),
    new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isValidLatLng(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export function isShortMapsLink(input: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(input.trim());
}

/** Distancia en km (fórmula del haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ResolvedPlace extends LatLng {
  formatted_address: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  timezone: string | null;
}
