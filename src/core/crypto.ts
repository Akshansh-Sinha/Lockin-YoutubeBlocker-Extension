// Web Crypto API helpers for password hashing

/**
 * Generates a random salt (base64 encoded).
 */
export function generateSalt(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return btoa(String.fromCharCode(...buffer));
}

/**
 * Hashes a password with a given salt using PBKDF2-HMAC-SHA256.
 * Returns a base64 encoded hash.
 */
export async function hashPassword(password: string, saltStr: string): Promise<string> {
  const enc = new TextEncoder();
  
  // Base64 decode salt
  const saltStrDecoded = atob(saltStr);
  const salt = new Uint8Array(saltStrDecoded.length);
  for (let i = 0; i < saltStrDecoded.length; i++) {
    salt[i] = saltStrDecoded.charCodeAt(i);
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // length in bits
  );

  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

/**
 * Verifies a password against a stored hash and salt.
 */
export async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}
