import packageMetadata from "../package.json" with { type: "json" };
import { generateValidatorDepositArtifact } from "./validator/deposit.ts";
import type {
  ValidatorDepositData,
  ValidatorWithdrawalCredentials,
} from "./validator/types.ts";

const packageVersion = packageMetadata.version;

/**
 * Signs validator deposit data and returns the canonical JSON format.
 *
 * The function signs with `DOMAIN_DEPOSIT` and the selected network fork.
 * The result stores the Gwei amount as a number.
 * The result stores the package version in `deposit_cli_version`.
 *
 * @param pubkey This value contains the 48-byte validator BLS public key.
 * @param signing This value contains the matching 32-byte BLS secret key.
 * @param withdrawalCredentials This value contains 32-byte withdrawal credentials.
 * @param amount This value gives the deposit amount in Gwei.
 * @param chain This string gives a supported network name.
 * @returns The function returns signed canonical validator deposit data.
 * @throws The function throws if the network, SSZ data, or key material is invalid.
 */
export async function generateValidatorDepositData(
  pubkey: Uint8Array,
  signing: Uint8Array,
  withdrawalCredentials: ValidatorWithdrawalCredentials,
  amount: number,
  chain: string
): Promise<ValidatorDepositData> {
  return generateValidatorDepositArtifact(
    pubkey,
    signing,
    withdrawalCredentials,
    amount,
    chain,
    packageVersion
  );
}

export { buildBuilderCallArtifact } from "./builder/call.ts";
export {
  encodeBuilderDepositCalldata,
  encodeBuilderDepositRequestRecord,
} from "./builder/encoding.ts";
export {
  buildBuilderWithdrawalCredentials,
  generateBuilderKeys,
} from "./builder/key.ts";
export {
  BUILDER_DEPOSIT_CALLDATA_LENGTH,
  BUILDER_DEPOSIT_CONTRACT_ADDRESS,
  BUILDER_DEPOSIT_REQUEST_TYPE,
  BUILDER_MIN_DEPOSIT_GWEI,
  BUILDER_MIN_REQUEST_FEE_WEI,
  builderProfiles,
  DOMAIN_BEACON_BUILDER,
  DOMAIN_BUILDER_DEPOSIT,
  getBuilderProfile,
  listBuilderProfiles,
} from "./builder/profiles.ts";
export {
  BuilderDepositMessageType,
  BuilderDepositRequestType,
  generateBuilderDepositRequest,
  verifyBuilderDepositRequest,
} from "./builder/request.ts";
export type {
  BuilderCallArtifact,
  BuilderDepositRequest,
  BuilderKeys,
  BuilderNetworkAvailability,
  BuilderProfile,
  BuilderProfileId,
  BuilderProfileMaturity,
  BuilderProfileSource,
} from "./builder/types.ts";
export type { NetworkConfig } from "./consensus.ts";
export {
  computeDomain,
  computeSigningRoot,
  DOMAIN_DEPOSIT,
  getNetworkConfig,
  networks,
  ZERO_HASH,
} from "./consensus.ts";
export { sha256, sha256Concat } from "./crypto/hash.ts";
export { debugLog } from "./debug.ts";
export {
  decodeHex as fromHex,
  encodeHex as hex,
  isHexAddr,
  parseAddress,
} from "./hex.ts";
export {
  encodeGweiAsBigEndian8,
  encodeGweiAsLittleEndian8,
  ONE_ETH_GWEI,
} from "./units.ts";
export {
  computeDepositDataRoot,
  DepositDataType,
  DepositMessageType,
  verifyValidatorDepositData,
} from "./validator/deposit.ts";
export {
  generateValidatorKeys,
  getValidatorPublicInfo,
} from "./validator/key.ts";
export type {
  ValidatorDepositData,
  ValidatorKeys,
  ValidatorWithdrawalCredentials,
  ValidatorWithdrawalCredentialsType,
} from "./validator/types.ts";
export { buildValidatorWithdrawalCredentials } from "./validator/withdrawal.ts";
