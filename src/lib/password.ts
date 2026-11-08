import bcrypt from "bcryptjs";

// Native WebCrypto instead of pure-JS bcrypt (~350 ms CPU). PBKDF2 is still ~80 ms of CPU locally (workerd caps it at
// 100000 iterations), over the free plan's 10 ms limit, so every caller must be rate limited (better-auth sign-in, changePasswordAction).
const ITERATIONS = 100_000;
const PREFIX = "pbkdf2-sha256";

const subtle = globalThis.crypto.subtle;
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

/** `pbkdf2-sha256$<iterations>$<base64 salt>$<base64 key>` */
export async function hashPassword(password: string) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(await derive(password, salt, ITERATIONS))}`;
}

/** bcrypt hashes written before the PBKDF2 switch ($2a/$2b/$2y). */
export function isLegacyHash(hash: string) {
  return hash.startsWith("$2");
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  if (isLegacyHash(hash)) return bcrypt.compare(password, hash);
  const [prefix, iterations, salt, key, ...extra] = hash.split("$");
  const count = Number(iterations);
  if (prefix !== PREFIX || extra.length || !Number.isInteger(count) || count < 1 || count > ITERATIONS || !salt || !key) return false;
  try {
    const expected = fromBase64(key);
    const actual = await derive(password, fromBase64(salt), count);
    // Lengths are public (fixed by the format), so an early length check leaks nothing.
    if (expected.length !== actual.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false; // malformed base64
  }
}
