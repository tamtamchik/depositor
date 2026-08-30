import { ByteVectorType, ContainerType } from "@chainsafe/ssz";

/**
 * Defines the consensus data that deposit signatures use for one network.
 */
export interface NetworkConfig {
  /** Gives the canonical lowercase network name. */
  readonly name: string;
  /** Contains the 4-byte consensus fork version. */
  readonly forkVersion: Uint8Array;
}

const DEPOSIT_DOMAIN_TYPE = [0x03, 0x00, 0x00, 0x00] as const;
const ZERO_GENESIS_VALIDATORS_ROOT = new Uint8Array(32);

/**
 * Contains the 4-byte validator deposit domain type.
 *
 * Verify: https://github.com/ethereum/consensus-specs/blob/v1.7.0-alpha.11/specs/phase0/beacon-chain.md#domain-types
 */
export const DOMAIN_DEPOSIT = Uint8Array.from(DEPOSIT_DOMAIN_TYPE);
/**
 * Contains a public 32-byte zero-root snapshot.
 *
 * Verify: https://github.com/ethereum/consensus-specs/blob/v1.7.0-alpha.11/specs/phase0/beacon-chain.md#compute_domain
 */
export const ZERO_HASH = new Uint8Array(32);

const ForkDataType = new ContainerType({
  currentVersion: new ByteVectorType(4),
  genesisValidatorsRoot: new ByteVectorType(32),
});

const SigningDataType = new ContainerType({
  objectRoot: new ByteVectorType(32),
  domain: new ByteVectorType(32),
});

function assertByteLength(
  value: Uint8Array,
  expected: number,
  field: string
): void {
  if (value.length !== expected) {
    throw new Error(`${field} must be exactly ${expected} bytes`);
  }
}

/**
 * Creates a 32-byte consensus signing domain.
 *
 * The first four bytes contain `domainType`.
 * Bytes 4 through 31 contain the first 28 bytes of the SSZ fork-data root.
 *
 * @param domainType This value contains the 4-byte consensus domain type.
 * @param forkVersion This value contains the 4-byte consensus fork version.
 * @param genesisValidatorsRoot This value contains the 32-byte genesis validators root.
 * @returns The function returns a new 32-byte signing domain.
 * @throws The function throws if any input has an incorrect byte length.
 */
export function computeDomain(
  domainType: Uint8Array,
  forkVersion: Uint8Array,
  genesisValidatorsRoot: Uint8Array
): Uint8Array {
  assertByteLength(domainType, 4, "Domain type");
  assertByteLength(forkVersion, 4, "Fork version");
  assertByteLength(genesisValidatorsRoot, 32, "Genesis validators root");
  const forkDataRoot = ForkDataType.hashTreeRoot({
    currentVersion: forkVersion,
    genesisValidatorsRoot,
  });
  const domain = new Uint8Array(32);
  domain.set(domainType, 0);
  domain.set(forkDataRoot.subarray(0, 28), 4);
  return domain;
}

/**
 * Creates the validator deposit signing domain for one fork version.
 *
 * The function uses `DOMAIN_DEPOSIT` and a zero genesis validators root.
 * The function does not depend on mutable exported byte arrays.
 *
 * @param forkVersion This value contains the 4-byte consensus fork version.
 * @returns The function returns a new 32-byte validator deposit domain.
 * @throws The function throws if the fork version does not have 4 bytes.
 */
export function computeValidatorDepositDomain(
  forkVersion: Uint8Array
): Uint8Array {
  return computeDomain(
    Uint8Array.from(DEPOSIT_DOMAIN_TYPE),
    forkVersion,
    ZERO_GENESIS_VALIDATORS_ROOT
  );
}

/**
 * Creates the SSZ signing root for an object root and a domain.
 *
 * @param objectRoot This value contains the 32-byte SSZ object root.
 * @param domain This value contains the 32-byte signing domain.
 * @returns The function returns a new 32-byte SSZ signing root.
 * @throws The function throws if an input does not have 32 bytes.
 */
export function computeSigningRoot(
  objectRoot: Uint8Array,
  domain: Uint8Array
): Uint8Array {
  assertByteLength(objectRoot, 32, "Object root");
  assertByteLength(domain, 32, "Domain");
  return SigningDataType.hashTreeRoot({ objectRoot, domain });
}

const networkForkVersions = {
  mainnet: [0x00, 0x00, 0x00, 0x00],
  sepolia: [0x90, 0x00, 0x00, 0x69],
  hoodi: [0x10, 0x00, 0x09, 0x10],
} as const;

type NetworkName = keyof typeof networkForkVersions;

function createNetworkConfig(name: NetworkName): NetworkConfig {
  return Object.freeze({
    name,
    forkVersion: Uint8Array.from(networkForkVersions[name]),
  });
}

/** Contains public snapshots of every supported consensus network. */
export const networks: Readonly<Record<string, NetworkConfig>> =
  Object.freeze({
    mainnet: createNetworkConfig("mainnet"),
    sepolia: createNetworkConfig("sepolia"),
    hoodi: createNetworkConfig("hoodi"),
  });

/**
 * Gets the consensus configuration for a supported network.
 *
 * Network-name matching is not case-sensitive.
 *
 * @param chain This string gives a supported network name.
 * @returns The function returns a new configuration object for the network.
 * @throws The function throws if the network name is not supported.
 */
export function getNetworkConfig(chain: string): NetworkConfig {
  const name = chain.toLowerCase();
  if (!Object.hasOwn(networkForkVersions, name)) {
    throw new Error(`Unsupported network: ${chain}`);
  }
  return createNetworkConfig(name as NetworkName);
}
