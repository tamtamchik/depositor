import { decodeHexExact, encodeHex } from "../hex.ts";
import { UINT64_MAX } from "../units.ts";
import { getBuilderProfile } from "./profiles.ts";
import type {
  BuilderDepositRequest,
  BuilderProfile,
} from "./types.ts";

const UINT256_MAX = (1n << 256n) - 1n;

/**
 * Validates a dynamic execution request fee for one compatibility profile.
 *
 * @param feeWei This value gives the supplied execution request fee in wei.
 * @param profile This object supplies the profile-specific minimum fee.
 * @returns The function returns the unchanged fee in wei.
 * @throws The function throws if the fee is below the profile minimum or exceeds uint256.
 */
export function validateRequestFee(
  feeWei: bigint,
  profile: BuilderProfile
): bigint {
  if (feeWei < profile.minimumRequestFeeWei) {
    throw new Error(
      `Request fee must be at least ${profile.minimumRequestFeeWei} wei for profile ${profile.id}`
    );
  }
  if (feeWei > UINT256_MAX) {
    throw new Error("Request fee must fit an unsigned 256-bit wei value");
  }
  return feeWei;
}

/**
 * Calculates the execution transaction value for a builder deposit call.
 *
 * @param amountWei This value gives the builder deposit amount in wei.
 * @param feeWei This value gives the dynamic execution request fee in wei.
 * @param profile This object supplies the profile-specific minimum fee.
 * @returns The function returns deposit amount plus request fee in wei.
 * @throws The function throws if the fee or final value does not fit the transaction contract.
 */
export function calculateBuilderCallValue(
  amountWei: bigint,
  feeWei: bigint,
  profile: BuilderProfile
): bigint {
  const valueWei = amountWei + validateRequestFee(feeWei, profile);
  if (valueWei > UINT256_MAX) {
    throw new Error("Builder call value must fit an unsigned 256-bit wei value");
  }
  return valueWei;
}

/**
 * Validates a builder deposit amount for one compatibility profile.
 *
 * The amount must fit an unsigned 64-bit Gwei value.
 * The amount must meet the profile minimum.
 *
 * @param amountGwei This value gives the builder deposit amount in Gwei.
 * @param profile This object supplies the profile-specific minimum amount.
 * @returns The function returns the unchanged Gwei amount.
 * @throws The function throws if the amount exceeds uint64 or is below the minimum.
 */
export function validateBuilderAmount(
  amountGwei: bigint,
  profile: BuilderProfile
): bigint {
  if (amountGwei > UINT64_MAX) {
    throw new Error("Builder amount must fit an unsigned 64-bit Gwei value");
  }
  if (amountGwei < profile.minimumDepositGwei) {
    throw new Error(
      `Builder amount must be at least ${profile.minimumDepositGwei} Gwei for profile ${profile.id}`
    );
  }
  return amountGwei;
}

/**
 * Resolves the compatibility profile declared by a builder request.
 *
 * @param request This object contains the profile identifier.
 * @returns The function returns the frozen compatibility profile.
 * @throws The function throws if the profile identifier is unknown.
 */
export function profileForRequest(
  request: BuilderDepositRequest
): BuilderProfile {
  return getBuilderProfile(request.spec_profile);
}

/**
 * Decodes the builder deposit domain type from a compatibility profile.
 *
 * @param profile This object contains the hexadecimal domain type.
 * @returns The function returns the 4-byte domain type.
 * @throws The function throws if the profile value is not exactly 4 bytes of hex.
 */
export function builderDepositDomainType(
  profile: BuilderProfile
): Uint8Array {
  return decodeHexExact(
    profile.domainBuilderDeposit,
    4,
    "Builder deposit domain type"
  );
}

function decodeCanonicalHex(
  value: string,
  byteLength: number,
  field: string
): Uint8Array {
  const decoded = decodeHexExact(value, byteLength, field);
  if (value !== encodeHex(decoded)) {
    throw new Error(`${field} must use lowercase hex without a 0x prefix`);
  }
  return decoded;
}

function parseBuilderAmount(
  amount: string,
  profile: BuilderProfile
): bigint {
  if (!/^(0|[1-9]\d*)$/.test(amount)) {
    throw new Error("Builder amount must use canonical decimal Gwei text");
  }
  return validateBuilderAmount(BigInt(amount), profile);
}

/**
 * Decodes the wire fields of a builder deposit request.
 *
 * The function validates the profile, field lengths, and Gwei amount.
 * The function does not verify profile metadata, roots, or the BLS signature.
 *
 * @param request This object contains the encoded builder deposit fields.
 * @returns The function returns decoded request fields and the selected profile.
 * @throws The function throws if a profile, hexadecimal field, or amount is invalid.
 */
export function requestFields(request: BuilderDepositRequest): {
  profile: BuilderProfile;
  pubkey: Uint8Array;
  withdrawalCredentials: Uint8Array;
  amount: bigint;
  signature: Uint8Array;
} {
  const profile = profileForRequest(request);
  return {
    profile,
    pubkey: decodeCanonicalHex(request.pubkey, 48, "Builder public key"),
    withdrawalCredentials: decodeCanonicalHex(
      request.withdrawal_credentials,
      32,
      "Builder withdrawal credentials"
    ),
    amount: parseBuilderAmount(request.amount, profile),
    signature: decodeCanonicalHex(request.signature, 96, "Builder signature"),
  };
}
