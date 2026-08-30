/** Gives the largest value that fits an unsigned 64-bit integer. */
export const UINT64_MAX = (1n << 64n) - 1n;
/** Gives one ETH in Gwei. */
export const ONE_ETH_GWEI = 1_000_000_000;
/** Gives one Gwei in wei. */
export const WEI_PER_GWEI = 1_000_000_000n;

function encodeGwei(amountGwei: bigint, bigEndian: boolean): Uint8Array {
  if (amountGwei < 0n || amountGwei > UINT64_MAX) {
    throw new Error("Amount must fit an unsigned 64-bit Gwei value");
  }
  const bytes = new Uint8Array(8);
  for (let index = 0; index < bytes.length; index++) {
    const target = bigEndian ? bytes.length - 1 - index : index;
    bytes[target] = Number((amountGwei >> BigInt(index * 8)) & 0xffn);
  }
  return bytes;
}

/**
 * Encodes an unsigned Gwei amount as little-endian uint64 data.
 *
 * The input must be in the range from 0 through `2^64 - 1`.
 *
 * @param amountGwei This value gives the amount in Gwei.
 * @returns The function returns a new 8-byte array.
 * @throws The function throws if the amount is outside the uint64 range.
 */
export function encodeGweiAsLittleEndian8(amountGwei: bigint): Uint8Array {
  return encodeGwei(amountGwei, false);
}

/**
 * Encodes an unsigned Gwei amount as big-endian uint64 data.
 *
 * The input must be in the range from 0 through `2^64 - 1`.
 *
 * @param amountGwei This value gives the amount in Gwei.
 * @returns The function returns a new 8-byte array.
 * @throws The function throws if the amount is outside the uint64 range.
 */
export function encodeGweiAsBigEndian8(amountGwei: bigint): Uint8Array {
  return encodeGwei(amountGwei, true);
}
