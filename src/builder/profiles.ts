import { decodeHexExact } from "../hex.ts";
import type { BuilderProfile, BuilderProfileId } from "./types.ts";

const unavailableNetworks = Object.freeze({
  mainnet: "unavailable",
  sepolia: "unavailable",
  hoodi: "unavailable",
} as const);

type SharedBuilderProfile = Omit<
  BuilderProfile,
  "id" | "sources" | "withdrawalCredentialVersion"
>;

type BuilderProfileDefinition = Pick<
  BuilderProfile,
  "id" | "sources" | "withdrawalCredentialVersion"
>;

const sharedBuilderProfile: Readonly<SharedBuilderProfile> = Object.freeze({
  maturity: "research-only",
  reviewedAt: "2026-08-30",
  builderVersion: 0,
  domainBuilderDeposit: "0x0e000000",
  domainBeaconBuilder: "0x0b000000",
  depositRequestType: 0x03,
  depositContractAddress: "0x0000bFF46984e3725691FA540a8C7589300D8282",
  minimumDepositGwei: 1_000_000_000n,
  minimumRequestFeeWei: 1n,
  calldataLength: 184,
  networkAvailability: unavailableNetworks,
});

function defineBuilderProfile(
  definition: BuilderProfileDefinition
): BuilderProfile {
  return Object.freeze({
    ...sharedBuilderProfile,
    ...definition,
    sources: Object.freeze(
      definition.sources.map((source) => Object.freeze({ ...source }))
    ),
  });
}

/** Contains every immutable built-in builder compatibility profile. */
export const builderProfiles: Readonly<
  Record<BuilderProfileId, BuilderProfile>
> = Object.freeze({
  "gloas-v1.7.0-alpha.11": defineBuilderProfile({
    id: "gloas-v1.7.0-alpha.11",
    sources: [
      {
        name: "Ethereum consensus specs Gloas",
        url: "https://github.com/ethereum/consensus-specs/blob/v1.7.0-alpha.11/specs/gloas/beacon-chain.md",
        revision: "7d5f3348d7b947851861745be9ce0ba30e526531",
      },
    ],
    withdrawalCredentialVersion: 0x03,
  }),
  "eip8282-review-2026-08-30": defineBuilderProfile({
    id: "eip8282-review-2026-08-30",
    sources: [
      {
        name: "EIP-8282 Builder Execution Requests",
        url: "https://github.com/ethereum/EIPs/blob/889f8c1e26e9b418f83721083098ca225b14fc0b/EIPS/eip-8282.md",
        revision: "889f8c1e26e9b418f83721083098ca225b14fc0b",
      },
      {
        name: "Ethereum consensus specs Gloas builder constants",
        url: "https://github.com/ethereum/consensus-specs/blob/3434cc69d695604ea52253e31486f46ba0e36901/specs/gloas/beacon-chain.md",
        revision: "3434cc69d695604ea52253e31486f46ba0e36901",
      },
    ],
    withdrawalCredentialVersion: 0xb0,
  }),
});

/**
 * Contains the 4-byte builder deposit proof-of-possession domain type.
 *
 * Verify: https://github.com/ethereum/consensus-specs/blob/7d5f3348d7b947851861745be9ce0ba30e526531/specs/gloas/beacon-chain.md#domains
 */
export const DOMAIN_BUILDER_DEPOSIT = decodeHexExact(
  sharedBuilderProfile.domainBuilderDeposit,
  4,
  "Builder deposit domain type"
);
/**
 * Contains the 4-byte operational beacon builder domain type.
 *
 * Verify: https://github.com/ethereum/consensus-specs/blob/7d5f3348d7b947851861745be9ce0ba30e526531/specs/gloas/beacon-chain.md#domains
 */
export const DOMAIN_BEACON_BUILDER = decodeHexExact(
  sharedBuilderProfile.domainBeaconBuilder,
  4,
  "Beacon builder domain type"
);

/**
 * Gives the checksummed builder deposit predeploy address.
 *
 * Verify: https://github.com/ethereum/EIPs/blob/889f8c1e26e9b418f83721083098ca225b14fc0b/EIPS/eip-8282.md#constants
 */
export const BUILDER_DEPOSIT_CONTRACT_ADDRESS = sharedBuilderProfile.depositContractAddress;
/**
 * Gives the one-byte EIP-7685 builder deposit request type.
 *
 * Verify: https://github.com/ethereum/EIPs/blob/889f8c1e26e9b418f83721083098ca225b14fc0b/EIPS/eip-8282.md#constants
 */
export const BUILDER_DEPOSIT_REQUEST_TYPE = sharedBuilderProfile.depositRequestType;

/**
 * Gives the minimum builder deposit in Gwei.
 *
 * Verify: https://github.com/ethereum/EIPs/blob/889f8c1e26e9b418f83721083098ca225b14fc0b/EIPS/eip-8282.md#builder-deposit-contract
 */
export const BUILDER_MIN_DEPOSIT_GWEI = sharedBuilderProfile.minimumDepositGwei;
/**
 * Gives the minimum dynamic builder request fee in wei.
 *
 * Verify: https://github.com/ethereum/EIPs/blob/889f8c1e26e9b418f83721083098ca225b14fc0b/EIPS/eip-8282.md#constants
 */
export const BUILDER_MIN_REQUEST_FEE_WEI = sharedBuilderProfile.minimumRequestFeeWei;
/**
 * Gives the exact builder deposit calldata length in bytes.
 *
 * Verify: https://github.com/ethereum/EIPs/blob/889f8c1e26e9b418f83721083098ca225b14fc0b/EIPS/eip-8282.md#builder-deposit-contract
 */
export const BUILDER_DEPOSIT_CALLDATA_LENGTH = sharedBuilderProfile.calldataLength;

/**
 * Gets one immutable builder compatibility profile.
 *
 * @param profileId This string gives the exact profile identifier.
 * @returns The function returns the frozen profile from the registry.
 * @throws The function throws if the registry does not contain the identifier.
 */
export function getBuilderProfile(profileId: string): BuilderProfile {
  const profile = builderProfiles[profileId as BuilderProfileId];
  if (!profile) {
    throw new Error(
      `Unknown builder profile: ${profileId}. Available profiles: ${Object.keys(
        builderProfiles
      ).join(", ")}`
    );
  }
  return profile;
}

/**
 * Lists all immutable builder compatibility profiles.
 *
 * @returns The function returns a new array that contains frozen profiles.
 */
export function listBuilderProfiles(): readonly BuilderProfile[] {
  return Object.values(builderProfiles);
}
