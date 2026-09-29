/**
 * Lógica de propietario — IMPLEMENTADA EXACTAMENTE según especificación:
 * is_owner = email ∈ OWNER_EMAILS  ||  el usuario canjeó OWNER_DISCOUNT_CODE (PANCHAN100)
 */
export function parseOwnerEmails(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined, ownerEmails: string[]): boolean {
  if (!email) return false;
  return ownerEmails.includes(email.trim().toLowerCase());
}

export function isOwner(params: {
  email: string | null | undefined;
  ownerEmails: string[];
  ownerCode: string;
  redeemedCodes: string[];
}): boolean {
  const code = params.ownerCode.trim().toUpperCase();
  return (
    isOwnerEmail(params.email, params.ownerEmails) ||
    params.redeemedCodes.some((c) => c.trim().toUpperCase() === code)
  );
}
