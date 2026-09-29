import { GEO_DATA } from "./geoData";
import { haversineKm, type LatLng, type ResolvedPlace } from "./geo";

/** Códigos ISO de todos los países (los nombres se localizan con Intl.DisplayNames). */
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GF GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ " +
  "OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ " +
  "UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW"
).split(" ");

/** Países con regiones incluidas (primero en la lista). */
export const FEATURED_COUNTRIES = ["ES", "CO", "MX", "AR", "CL", "PE", "VE", "EC", "US"];

export function countryName(code: string, locale = "es"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function sortedCountries(locale = "es"): Array<{ code: string; name: string }> {
  const featured = FEATURED_COUNTRIES.map((code) => ({ code, name: countryName(code, locale) }));
  const rest = COUNTRY_CODES.filter((c) => !FEATURED_COUNTRIES.includes(c))
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return [...featured, ...rest];
}

export function bundledRegions(country: string): string[] | null {
  const r = GEO_DATA[country.toUpperCase()];
  return r ? r.map(([name]) => name) : null;
}

export function bundledCities(country: string, region: string): Array<{ name: string } & LatLng> | null {
  const r = GEO_DATA[country.toUpperCase()]?.find(([name]) => name === region);
  return r ? r[1].map(([name, lat, lng]) => ({ name, lat, lng })) : null;
}

export function findBundledCity(country: string, region: string | null, city: string): LatLng | null {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const regions = GEO_DATA[country.toUpperCase()];
  if (!regions) return null;
  for (const [rName, cities] of regions) {
    if (region && norm(rName) !== norm(region)) continue;
    const hit = cities.find(([name]) => norm(name) === norm(city));
    if (hit) return { lat: hit[1], lng: hit[2] };
  }
  // Sin ciudad: capital de la región
  if (region) {
    const r = regions.find(([n]) => norm(n) === norm(region));
    if (r) return { lat: r[1][0][1], lng: r[1][0][2] };
  }
  return null;
}

/** Ciudad incluida más cercana (respaldo cuando no hay geocodificación inversa). */
export function nearestBundledPlace(p: LatLng): ResolvedPlace | null {
  let best: { d: number; place: ResolvedPlace } | null = null;
  for (const [cc, regions] of Object.entries(GEO_DATA)) {
    for (const [region, cities] of regions) {
      for (const [city, lat, lng] of cities) {
        const d = haversineKm(p, { lat, lng });
        if (!best || d < best.d) {
          best = {
            d,
            place: {
              lat: p.lat,
              lng: p.lng,
              city,
              state: region,
              country: countryName(cc),
              formatted_address: `Cerca de ${city}, ${region}, ${countryName(cc)}`,
              timezone: guessTimezone(cc, p.lat, p.lng),
            },
          };
        }
      }
    }
  }
  return best && best.d < 150 ? best.place : null;
}

/** Zona horaria aproximada para los países incluidos. */
export function guessTimezone(country: string | null, lat: number, lng: number): string | null {
  switch ((country ?? "").toUpperCase()) {
    case "ES":
      return lng < -12 ? "Atlantic/Canary" : "Europe/Madrid";
    case "CO":
      return "America/Bogota";
    case "MX":
      if (lng < -114) return "America/Tijuana";
      if (lng < -105.5 && lat > 22) return "America/Hermosillo";
      if (lng > -88) return "America/Cancun";
      return "America/Mexico_City";
    case "AR":
      return "America/Argentina/Buenos_Aires";
    case "CL":
      return "America/Santiago";
    case "PE":
      return "America/Lima";
    case "VE":
      return "America/Caracas";
    case "EC":
      return lng < -85 ? "Pacific/Galapagos" : "America/Guayaquil";
    case "US":
      if (lat > 51 && lng < -130) return "America/Anchorage";
      if (lat < 23 && lng < -150) return "Pacific/Honolulu";
      if (lng > -87.5) return "America/New_York";
      if (lng > -102) return "America/Chicago";
      if (lng > -114.5) return lat < 37 && lng < -109 ? "America/Phoenix" : "America/Denver";
      return "America/Los_Angeles";
    default:
      return null;
  }
}
