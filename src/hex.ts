import { toHexString } from "@chainsafe/ssz";

function normalizeHex(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function assertHex(value: string, field: string): void {
  if (value.length > 0 && !/^[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`${field} must contain only hex characters`);
  }
}

/**
 * Converts bytes to lowercase hexadecimal text without a `0x` prefix.
 *
 * @param value This value contains the bytes to encode.
 * @returns The function returns two hexadecimal characters per input byte.
 */
export function encodeHex(value: Uint8Array): string {
  return toHexString(value).slice(2);
}

/**
 * Converts hexadecimal text to bytes.
 *
 * The `0x` prefix is optional.
 * The function adds a leading zero to an odd-length value.
 *
 * @param value This string contains only hexadecimal characters.
 * @returns The function returns a new byte array.
 * @throws The function throws if the input contains a non-hex character.
 */
export function decodeHex(value: string): Uint8Array {
  let normalized = normalizeHex(value);
  assertHex(normalized, "Value");
  if (normalized.length % 2 !== 0) {
    normalized = `0${normalized}`;
  }
  return Uint8Array.from(
    { length: normalized.length / 2 },
    (_, index) =>
      Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16)
  );
}

/**
 * Converts exact-length hexadecimal text to bytes.
 *
 * The `0x` prefix is optional.
 * The input must contain exactly two hexadecimal characters per byte.
 *
 * @param value This string contains the hexadecimal value.
 * @param byteLength This number gives the required byte length.
 * @param field This string identifies the field in an error message.
 * @returns The function returns a new byte array with `byteLength` bytes.
 * @throws The function throws if the input has the wrong length or invalid characters.
 */
export function decodeHexExact(
  value: string,
  byteLength: number,
  field: string
): Uint8Array {
  const normalized = normalizeHex(value);
  if (normalized.length !== byteLength * 2) {
    throw new Error(`${field} must be exactly ${byteLength} bytes of hex`);
  }
  assertHex(normalized, field);
  return decodeHex(normalized);
}

/**
 * Tests the syntax of an Ethereum execution address.
 *
 * This function does not verify an EIP-55 checksum.
 *
 * @param address This string must contain `0x` and exactly 40 hex characters.
 * @returns The function returns true when the string has the required syntax.
 */
export function isHexAddr(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Converts an Ethereum execution address to 20 bytes.
 *
 * @param address This string must contain `0x` and exactly 40 hex characters.
 * @returns The function returns a new 20-byte address.
 * @throws The function throws if the address syntax is incorrect.
 */
export function parseAddress(address: string): Uint8Array {
  if (!isHexAddr(address)) {
    throw new Error("Address must be 0x + 40 hex chars");
  }
  return decodeHexExact(address, 20, "Withdrawal address");
}
