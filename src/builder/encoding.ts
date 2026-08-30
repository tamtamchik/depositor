import {
  encodeGweiAsBigEndian8,
  encodeGweiAsLittleEndian8,
} from "../units.ts";
import { getBuilderProfile } from "./profiles.ts";
import type {
  BuilderDepositRequest,
  BuilderProfileId,
} from "./types.ts";
import { requestFields } from "./validation.ts";

const PUBKEY_OFFSET = 0;
const WITHDRAWAL_CREDENTIALS_OFFSET = 48;
const AMOUNT_OFFSET = 80;
const SIGNATURE_OFFSET = 88;
const SIGNATURE_LENGTH = 96;
const ENCODED_REQUEST_LENGTH = SIGNATURE_OFFSET + SIGNATURE_LENGTH;

function assertProfileLength(
  profileId: string,
  profileLength: number
): void {
  if (profileLength !== ENCODED_REQUEST_LENGTH) {
    throw new Error(
      `Builder calldata must be exactly ${profileLength} bytes for profile ${profileId}`
    );
  }
}

/**
 * Encodes builder deposit contract calldata.
 *
 * The 184-byte result contains the public key, withdrawal credentials,
 * big-endian amount, and signature.
 * This function checks field lengths and the uint64 amount.
 * This function does not verify the BLS signature.
 *
 * @param request This object supplies the builder deposit fields.
 * @param profileId This value selects the wire-format and amount limits.
 * @returns The function returns new 184-byte calldata.
 * @throws The function throws if the profile, a field length, or the amount is invalid.
 */
export function encodeBuilderDepositCalldata(
  request: BuilderDepositRequest,
  profileId: BuilderProfileId
): Uint8Array {
  const profile = getBuilderProfile(profileId);
  const fields = requestFields(request, profile);
  assertProfileLength(profile.id, profile.calldataLength);
  const calldata = new Uint8Array(ENCODED_REQUEST_LENGTH);
  calldata.set(fields.pubkey, PUBKEY_OFFSET);
  calldata.set(fields.withdrawalCredentials, WITHDRAWAL_CREDENTIALS_OFFSET);
  calldata.set(encodeGweiAsBigEndian8(fields.amount), AMOUNT_OFFSET);
  calldata.set(fields.signature, SIGNATURE_OFFSET);
  return calldata;
}

/**
 * Encodes the consensus builder deposit request record.
 *
 * The 184-byte result contains the public key, withdrawal credentials,
 * little-endian amount, and signature.
 * This function checks field lengths and the uint64 amount.
 * This function does not verify the BLS signature.
 *
 * @param request This object supplies the builder deposit fields.
 * @param profileId This value selects the wire-format and amount limits.
 * @returns The function returns a new 184-byte request record.
 * @throws The function throws if the profile, a field length, or the amount is invalid.
 */
export function encodeBuilderDepositRequestRecord(
  request: BuilderDepositRequest,
  profileId: BuilderProfileId
): Uint8Array {
  const profile = getBuilderProfile(profileId);
  const fields = requestFields(request, profile);
  assertProfileLength(profile.id, profile.calldataLength);
  const record = new Uint8Array(ENCODED_REQUEST_LENGTH);
  record.set(fields.pubkey, PUBKEY_OFFSET);
  record.set(fields.withdrawalCredentials, WITHDRAWAL_CREDENTIALS_OFFSET);
  record.set(encodeGweiAsLittleEndian8(fields.amount), AMOUNT_OFFSET);
  record.set(fields.signature, SIGNATURE_OFFSET);
  return record;
}
