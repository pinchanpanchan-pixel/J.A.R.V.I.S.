/**
 * Número de emergencias según el país de tu ubicación. Acepta el nombre (en español o
 * inglés) o el código ISO; si no se sabe, se deduce de la zona horaria. Por defecto, 112
 * (funciona en toda Europa y en muchos móviles de otros países).
 */
const BY_CODE: Record<string, string> = {
  US: "911", CA: "911", MX: "911", PR: "911", PA: "911", CR: "911", SV: "911", HN: "911", GT: "110", NI: "118",
  AR: "911", UY: "911", PY: "911", PE: "105", CO: "123", VE: "911", EC: "911", BO: "110", CL: "131", DO: "911", CU: "106",
  BR: "190", GB: "999", IE: "112", AU: "000", NZ: "111", IN: "112", JP: "110", CN: "110", KR: "112", ZA: "10111",
};
const NAMES: Record<string, string> = {
  "estados unidos": "US", "united states": "US", "ee uu": "US", eeuu: "US", usa: "US", canada: "CA", mexico: "MX", "puerto rico": "PR", panama: "PA",
  "costa rica": "CR", "el salvador": "SV", honduras: "HN", guatemala: "GT", nicaragua: "NI", argentina: "AR", uruguay: "UY", paraguay: "PY",
  peru: "PE", colombia: "CO", venezuela: "VE", ecuador: "EC", bolivia: "BO", chile: "CL", "republica dominicana": "DO", "dominican republic": "DO",
  cuba: "CU", brasil: "BR", brazil: "BR", "reino unido": "GB", "united kingdom": "GB", irlanda: "IE", ireland: "IE", australia: "AU",
  "nueva zelanda": "NZ", "new zealand": "NZ", india: "IN", japon: "JP", japan: "JP", china: "CN", "corea del sur": "KR", "south korea": "KR",
  sudafrica: "ZA", "south africa": "ZA",
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[.]/g, "").trim();

export interface EmergencyNumber {
  number: string;
  /** Texto del botón: «Llamar a emergencias (112)». */
  label: string;
}

export function emergencyNumber(country: string | null | undefined, timezone?: string | null): EmergencyNumber {
  let code: string | undefined;
  if (country) {
    const c = country.trim();
    code = /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : NAMES[norm(c)];
  }
  let number = code ? (BY_CODE[code] ?? "112") : undefined;
  if (!number && timezone) {
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Toronto|Vancouver|Mexico_City|Argentina|Montevideo|Asuncion|Caracas|Guayaquil|Panama|Costa_Rica|El_Salvador|Tegucigalpa|Santo_Domingo|Puerto_Rico)/.test(timezone)) number = "911";
    else if (timezone === "America/Bogota") number = "123";
    else if (timezone === "America/Lima") number = "105";
    else if (timezone === "America/Santiago") number = "131";
    else if (timezone.startsWith("America/Sao_Paulo")) number = "190";
    else if (timezone === "Europe/London") number = "999";
  }
  number ??= "112";
  return { number, label: `Llamar a emergencias (${number})` };
}
