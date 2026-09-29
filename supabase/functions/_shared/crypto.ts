// Descifrado AES-256-GCM compatible con lib/crypto.ts (formato v1.<iv>.<tag>.<ct>, AAD = propósito:usuario).
const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

export async function openSealed(sealed: string, purpose: string, userId: string): Promise<string> {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1") throw new Error("formato inválido");
  const raw = Deno.env.get("ENCRYPTION_KEY");
  if (!raw) throw new Error("falta ENCRYPTION_KEY");
  const key = await crypto.subtle.importKey("raw", b64u(raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")), "AES-GCM", false, ["decrypt"]);
  const ctBytes = b64u(ct);
  const tagBytes = b64u(tag);
  const data = new Uint8Array(ctBytes.length + tagBytes.length);
  data.set(ctBytes);
  data.set(tagBytes, ctBytes.length);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64u(iv), additionalData: new TextEncoder().encode(`${purpose}:${userId}`) }, key, data);
  return new TextDecoder().decode(plain);
}
