import {
  ByteVectorType,
  ContainerType,
  UintBigintType,
} from "@chainsafe/ssz";

import {
  computeDomain,
  computeSigningRoot,
  getNetworkConfig,
} from "../consensus.ts";
import {
  getBlsPublicKey,
  signBlsProof,
  verifyBlsProof,
} from "../crypto/bls.ts";
import { encodeHex } from "../hex.ts";
import { buildBuilderWithdrawalCredentials } from "./key.ts";
import { getBuilderProfile } from "./profiles.ts";
import type {
  BuilderDepositRequest,
  BuilderProfileId,
} from "./types.ts";
import {
  builderDepositDomainType,
  requestFields,
  validateBuilderAmount,
} from "./validation.ts";

const ZERO_GENESIS_VALIDATORS_ROOT = new Uint8Array(32);

/**
 * Defines the SSZ fields signed by a builder deposit proof of possession.
 *
 * Verify: https://github.com/ethereum/consensus-specs/blob/7d5f3348d7b947851861745be9ce0ba30e526531/specs/gloas/beacon-chain.md#builderdepositrequest
 */
export const BuilderDepositMessageType = new ContainerType({
  pubkey: new ByteVectorType(48),
  withdrawalCredentials: new ByteVectorType(32),
  amount: new UintBigintType(8),
});

/**
 * Defines the 184-byte SSZ builder deposit request record.
 *
 * Verify: https://github.com/ethereum/EIPs/blob/889f8c1e26e9b418f83721083098ca225b14fc0b/EIPS/eip-8282.md#deposit-requests
 */
export const BuilderDepositRequestType = new ContainerType({
  pubkey: new ByteVectorType(48),
  withdrawalCredentials: new ByteVectorType(32),
  amount: new UintBigintType(8),
  signature: new ByteVectorType(96),
});

/**
 * Creates and signs one profile-bound builder deposit request.
 *
 * The signature uses the builder deposit domain from the selected profile.
 * The result contains only the four fields of the SSZ request container.
 * The function does not write a file.
 *
 * @param pubkey This value contains the 48-byte builder BLS public key.
 * @param signing This value contains the matching 32-byte BLS secret key.
 * @param executionAddress This string contains the builder withdrawal address.
 * @param amountGwei This value gives the deposit amount in Gwei.
 * @param chain This string gives a supported signing network.
 * @param profileId This value selects all builder wire-format constants.
 * @returns The function returns a signed builder deposit request.
 * @throws The function throws if a key, address, amount, network, or profile is invalid.
 */
export async function generateBuilderDepositRequest(
  pubkey: Uint8Array,
  signing: Uint8Array,
  executionAddress: string,
  amountGwei: bigint,
  chain: string,
  profileId: BuilderProfileId
): Promise<BuilderDepositRequest> {
  if (pubkey.length !== 48) {
    throw new Error("Builder public key must be exactly 48 bytes");
  }
  if (signing.length !== 32) {
    throw new Error("Builder secret key must be exactly 32 bytes");
  }
  if (encodeHex(getBlsPublicKey(signing)) !== encodeHex(pubkey)) {
    throw new Error("Builder public key does not match the secret key");
  }

  const profile = getBuilderProfile(profileId);
  const amount = validateBuilderAmount(amountGwei, profile);
  const network = getNetworkConfig(chain);
  const withdrawalCredentials = buildBuilderWithdrawalCredentials(
    executionAddress,
    profileId
  );
  const message = { pubkey, withdrawalCredentials, amount } as const;
  const messageRoot = BuilderDepositMessageType.hashTreeRoot(message);
  const domainType = builderDepositDomainType(profile);
  const domain = computeDomain(
    domainType,
    network.forkVersion,
    ZERO_GENESIS_VALIDATORS_ROOT
  );
  const signingRoot = computeSigningRoot(messageRoot, domain);
  const signature = signBlsProof(signingRoot, signing);

  return {
    pubkey: encodeHex(pubkey),
    withdrawal_credentials: encodeHex(withdrawalCredentials),
    amount: amount.toString(),
    signature: encodeHex(signature),
  };
}

function builderInvariantError(profileId: string, invariant: string): Error {
  return new Error(
    `Builder request invariant failed for profile ${profileId}: ${invariant}`
  );
}

/**
 * Asserts every invariant of a signed builder deposit request.
 *
 * The function checks byte lengths, the Gwei amount, withdrawal credentials,
 * and the BLS proof for the selected network and profile.
 *
 * @param request This object contains the signed builder deposit request.
 * @param chain This string selects the genesis fork version for the signing domain.
 * @param profileId This value selects the required compatibility profile.
 * @returns The promise resolves when every request invariant is valid.
 * @throws The function throws an invariant error when any request field is invalid.
 */
export async function assertBuilderDepositRequest(
  request: BuilderDepositRequest,
  chain: string,
  profileId: BuilderProfileId
): Promise<void> {
  const fail = (invariant: string): never => {
    throw builderInvariantError(profileId, invariant);
  };
  const captureInvariant = <T>(
    operation: () => T,
    fallback: string
  ): T => {
    try {
      return operation();
    } catch (error) {
      return fail(error instanceof Error ? error.message : fallback);
    }
  };

  const profile = captureInvariant(
    () => getBuilderProfile(profileId),
    "unknown builder profile"
  );

  const fields = captureInvariant(
    () => requestFields(request, profile),
    "malformed request fields"
  );
  const { pubkey, withdrawalCredentials, signature, amount } = fields;

  const expectedCredentials = captureInvariant(
    () =>
      buildBuilderWithdrawalCredentials(
        `0x${encodeHex(withdrawalCredentials.subarray(12))}`,
        profileId
      ),
    "malformed withdrawal credentials"
  );
  if (!Buffer.from(withdrawalCredentials).equals(expectedCredentials)) {
    fail("withdrawal credentials do not match the execution address");
  }

  try {
    const network = getNetworkConfig(chain);
    const message = { pubkey, withdrawalCredentials, amount } as const;
    const messageRoot = BuilderDepositMessageType.hashTreeRoot(message);
    const domain = computeDomain(
      builderDepositDomainType(profile),
      network.forkVersion,
      ZERO_GENESIS_VALIDATORS_ROOT
    );
    const signingRoot = computeSigningRoot(messageRoot, domain);
    const signatureValid = (() => {
      try {
        return verifyBlsProof(signature, signingRoot, pubkey);
      } catch {
        return false;
      }
    })();
    if (!signatureValid) {
      fail("BLS proof of possession is invalid");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Builder request invariant failed")
    ) {
      throw error;
    }
    fail(error instanceof Error ? error.message : "request verification failed");
  }
}

/**
 * Verifies all request invariants and the BLS proof of possession.
 *
 * The function also verifies field lengths, credentials, amount, network,
 * and profile-specific signing inputs.
 *
 * @param request This object contains the builder deposit request to verify.
 * @param chain This string selects the genesis fork version for the signing domain.
 * @param profileId This value selects the required compatibility profile.
 * @returns The function returns true only when every invariant is valid.
 */
export async function verifyBuilderDepositRequest(
  request: BuilderDepositRequest,
  chain: string,
  profileId: BuilderProfileId
): Promise<boolean> {
  try {
    await assertBuilderDepositRequest(request, chain, profileId);
    return true;
  } catch {
    return false;
  }
}
