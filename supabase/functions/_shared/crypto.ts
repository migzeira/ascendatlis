// AES-GCM helper. TOKEN_ENC_KEY é 32 bytes em base64.
import { requireEnv } from "./cors.ts";

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  const raw = b64ToBytes(requireEnv("TOKEN_ENC_KEY"));
  if (raw.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must decode to 32 bytes (AES-256)");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(
  plain: string,
): Promise<{ ct: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );
  return { ct, iv };
}

export async function decryptToken(
  ct: Uint8Array,
  iv: Uint8Array,
): Promise<string> {
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct,
  );
  return new TextDecoder().decode(plain);
}

// Postgres bytea vem como string "\\x<hex>" via PostgREST.
export function pgByteaToBytes(v: string | Uint8Array): Uint8Array {
  if (v instanceof Uint8Array) return v;
  const hex = v.startsWith("\\x") ? v.slice(2) : v;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export function bytesToPgBytea(b: Uint8Array): string {
  let hex = "\\x";
  for (const x of b) hex += x.toString(16).padStart(2, "0");
  return hex;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256(input: string): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return new Uint8Array(buf);
}
