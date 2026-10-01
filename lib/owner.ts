/**
 * Propietarios (v2): SOLO por email. Las cuentas de la lista ven Códigos de descuento y
 * Proveedores de IA y tienen Pro de por vida. Canjear PANCHAN100 ya no convierte en
 * propietario: ese código solo lo pueden usar ellos (lo impide también la base de datos,
 * con la tabla app_owner_emails).
 * OWNER_EMAILS (.env) añade emails a la lista por defecto.
 */
export const DEFAULT_OWNER_EMAILS = ["pinchan.panchan@gmail.com", "mateolabandayt@gmail.com"];

export function parseOwnerEmails(raw: string | undefined | null): string[] {
  const extra = (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_OWNER_EMAILS, ...extra])];
}

export function isOwnerEmail(email: string | null | undefined, ownerEmails: string[]): boolean {
  if (!email) return false;
  return ownerEmails.includes(email.trim().toLowerCase());
}

export function isOwner(params: { email: string | null | undefined; ownerEmails: string[] }): boolean {
  return isOwnerEmail(params.email, params.ownerEmails);
}
