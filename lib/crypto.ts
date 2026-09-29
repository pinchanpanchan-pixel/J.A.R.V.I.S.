import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { isMockMode } from "./env";

/**
 * Cifrado AES-256-GCM para tokens OAuth, claves de proveedores de IA y el diario.
 * Formato: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 * El AAD ata cada texto cifrado a su propósito y usuario: un texto cifrado de un
 * usuario no se puede descifrar en nombre de otro ni reutilizar para otro fin.
 * NUNCA se registra (log) el texto plano.
 */
export type SealPurpose = "diary" | "ai_key" | "oauth" | "generic";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
    throw new Error("ENCRYPTION_KEY debe ser de 32 bytes en base64 (openssl rand -base64 32)");
  }
  if (isMockMode || process.env.NODE_ENV !== "production") {
    // Clave de desarrollo determinista: SOLO para modo simulado/local.
    return createHash("sha256").update("jarvis-dev-only-key").digest();
  }
  throw new Error("Falta ENCRYPTION_KEY en producción");
}

const b64u = (b: Buffer) => b.toString("base64url");

export function seal(plaintext: string, purpose: SealPurpose, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(`${purpose}:${userId}`));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1.${b64u(iv)}.${b64u(cipher.getAuthTag())}.${b64u(ct)}`;
}

export function open(sealed: string, purpose: SealPurpose, userId: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("formato de cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`${purpose}:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export function last4(secret: string): string {
  return secret.trim().slice(-4);
}
