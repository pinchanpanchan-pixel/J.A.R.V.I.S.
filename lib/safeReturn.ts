/** Ruta interna segura a la que volver tras iniciar sesión (onboarding, Ajustes, Hogar…). */
export function safeReturn(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") && raw.length < 200 ? raw : "/settings?s=conexiones";
}
