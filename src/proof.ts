import { createHash } from "node:crypto";

export const fromHex = (hex: string): Uint8Array => {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

export const sha256Concat = (...inputs: Uint8Array[]): Uint8Array => {
  const hash = createHash("sha256");
  for (const input of inputs) {
    hash.update(input);
  }
  return new Uint8Array(hash.digest());
};

export const encodeGweiAsLittleEndian8 = (amountGwei: bigint): Uint8Array => {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number((amountGwei >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
};
