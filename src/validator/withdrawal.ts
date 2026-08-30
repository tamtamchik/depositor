import { sha256 } from "../crypto/hash.ts";
import { parseAddress } from "../hex.ts";
import type {
  ValidatorWithdrawalCredentials,
  ValidatorWithdrawalCredentialsType,
} from "./types.ts";

/**
 * Creates 32-byte validator withdrawal credentials.
 *
 * Type 0 stores bytes 1 through 31 of the SHA-256 public-key digest.
 * Type 1 or type 2 stores the execution address in bytes 12 through 31.
 *
 * @param type This value selects credential type 0, 1, or 2.
 * @param pub This value contains the validator BLS public key.
 * @param addr This string gives the execution address for type 1 or type 2.
 * @returns The function returns new 32-byte withdrawal credentials.
 * @throws The function throws if type 1 or type 2 has no valid address.
 */
export function buildValidatorWithdrawalCredentials(
  type: ValidatorWithdrawalCredentialsType,
  pub: Uint8Array,
  addr?: string
): ValidatorWithdrawalCredentials {
  if (![0, 1, 2].includes(type)) {
    throw new Error("Validator withdrawal credentials type must be 0, 1, or 2");
  }
  if (pub.length !== 48) {
    throw new Error("Validator public key must be exactly 48 bytes");
  }
  const out = new Uint8Array(32);
  if (type === 0) {
    out.set(sha256(pub).subarray(1), 1);
  } else {
    if (!addr) {
      throw new Error("--wc-address is required when --wc-type is 1 or 2");
    }
    out[0] = type;
    out.set(parseAddress(addr), 12);
  }
  return out;
}
