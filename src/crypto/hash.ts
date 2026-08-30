import { createHash } from "node:crypto";

/**
 * Calculates the SHA-256 digest of one byte array.
 *
 * @param d This value contains the bytes to hash.
 * @returns The function returns a new 32-byte digest.
 */
export function sha256(d: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(d).digest());
}

/**
 * Calculates one SHA-256 digest from a sequence of byte arrays.
 *
 * The function hashes the inputs in argument order with no separator bytes.
 *
 * @param inputs These values contain the byte arrays to hash.
 * @returns The function returns a new 32-byte digest.
 */
export function sha256Concat(...inputs: Uint8Array[]): Uint8Array {
  const hash = createHash("sha256");
  for (const input of inputs) {
    hash.update(input);
  }
  return new Uint8Array(hash.digest());
}
