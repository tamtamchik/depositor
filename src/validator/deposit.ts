import {
  ByteVectorType,
  ContainerType,
  UintNumberType,
} from "@chainsafe/ssz";

import {
  computeSigningRoot,
  computeValidatorDepositDomain,
  getNetworkConfig,
} from "../consensus.ts";
import {
  getBlsPublicKey,
  signBlsProof,
  verifyBlsProof,
} from "../crypto/bls.ts";
import { sha256Concat } from "../crypto/hash.ts";
import { debugLog } from "../debug.ts";
import { decodeHexExact, encodeHex } from "../hex.ts";
import { encodeGweiAsLittleEndian8, ONE_ETH_GWEI } from "../units.ts";
import type {
  ValidatorDepositData,
  ValidatorWithdrawalCredentials,
} from "./types.ts";

/**
 * Defines the SSZ fields signed by a validator deposit proof of possession.
 *
 * Verify: https://github.com/ethereum/consensus-specs/blob/v1.7.0-alpha.11/specs/phase0/validator.md#deposit-data
 */
export const DepositMessageType = new ContainerType({
  pubkey: new ByteVectorType(48),
  withdrawalCredentials: new ByteVectorType(32),
  amount: new UintNumberType(8),
});

/**
 * Defines the SSZ validator deposit data fields.
 *
 * Verify: https://github.com/ethereum/consensus-specs/blob/v1.7.0-alpha.11/specs/phase0/validator.md#deposit-data
 */
export const DepositDataType = new ContainerType({
  pubkey: new ByteVectorType(48),
  withdrawalCredentials: new ByteVectorType(32),
  amount: new UintNumberType(8),
  signature: new ByteVectorType(96),
});

/**
 * Calculates the SSZ root of validator deposit data.
 *
 * Hexadecimal inputs can have a `0x` prefix.
 * The amount uses little-endian uint64 encoding in the SSZ value.
 *
 * @param pubkey This string contains the 48-byte BLS public key.
 * @param withdrawalCredentials This string contains the 32-byte withdrawal credentials.
 * @param signature This string contains the 96-byte BLS signature.
 * @param amountGwei This value gives the deposit amount in Gwei.
 * @returns The function returns a 32-byte root as hex with a `0x` prefix.
 * @throws The function throws if a hexadecimal field has an invalid length or format.
 * @throws The function throws if the amount is not an unsigned 64-bit integer.
 */
export function computeDepositDataRoot(
  pubkey: string,
  withdrawalCredentials: string,
  signature: string,
  amountGwei: bigint | number
): string {
  const pubkeyBytes = decodeHexExact(pubkey, 48, "Validator public key");
  const withdrawalCredentialsBytes = decodeHexExact(
    withdrawalCredentials,
    32,
    "Validator withdrawal credentials"
  );
  const signatureBytes = decodeHexExact(
    signature,
    96,
    "Validator signature"
  );
  const amountLE64 = encodeGweiAsLittleEndian8(BigInt(amountGwei));

  const pubkeyRoot = sha256Concat(pubkeyBytes, new Uint8Array(16));
  const signatureRoot = sha256Concat(
    sha256Concat(signatureBytes.slice(0, 64)),
    sha256Concat(signatureBytes.slice(64), new Uint8Array(32))
  );
  const depositDataRoot = sha256Concat(
    sha256Concat(pubkeyRoot, withdrawalCredentialsBytes),
    sha256Concat(amountLE64, new Uint8Array(24), signatureRoot)
  );

  return `0x${encodeHex(depositDataRoot)}`;
}

function assertValidatorDepositInputs(
  pubkey: Uint8Array,
  signing: Uint8Array,
  withdrawalCredentials: Uint8Array,
  amount: number
): void {
  if (pubkey.length !== 48) {
    throw new Error("Validator public key must be exactly 48 bytes");
  }
  if (signing.length !== 32) {
    throw new Error("Validator secret key must be exactly 32 bytes");
  }
  if (withdrawalCredentials.length !== 32) {
    throw new Error("Validator withdrawal credentials must be exactly 32 bytes");
  }
  if (!Number.isSafeInteger(amount) || amount < ONE_ETH_GWEI) {
    throw new Error(
      `Validator amount must be a safe integer of at least ${ONE_ETH_GWEI} Gwei`
    );
  }
  if (encodeHex(getBlsPublicKey(signing)) !== encodeHex(pubkey)) {
    throw new Error("Validator public key does not match the secret key");
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/**
 * Signs canonical validator deposit data.
 *
 * The function signs with `DOMAIN_DEPOSIT` and the selected network fork.
 * The result stores the Gwei amount as a number.
 * The result stores the generator version in `deposit_cli_version`.
 *
 * @param pubkey This value contains the 48-byte validator BLS public key.
 * @param signing This value contains the matching 32-byte BLS secret key.
 * @param withdrawalCredentials This value contains 32-byte withdrawal credentials.
 * @param amount This value gives the deposit amount in Gwei.
 * @param chain This string gives a supported network name.
 * @param generatorVersion This string identifies the artifact generator version.
 * @returns The function returns signed canonical validator deposit data.
 * @throws The function throws if the network, SSZ data, or key material is invalid.
 */
export async function generateValidatorDepositArtifact(
  pubkey: Uint8Array,
  signing: Uint8Array,
  withdrawalCredentials: ValidatorWithdrawalCredentials,
  amount: number,
  chain: string,
  generatorVersion: string
): Promise<ValidatorDepositData> {
  assertValidatorDepositInputs(
    pubkey,
    signing,
    withdrawalCredentials,
    amount
  );
  const network = getNetworkConfig(chain);
  const domain = computeValidatorDepositDomain(network.forkVersion);
  const message = { pubkey, withdrawalCredentials, amount } as const;
  const messageRoot = DepositMessageType.hashTreeRoot(message);
  const signingRoot = computeSigningRoot(messageRoot, domain);
  const signature = signBlsProof(signingRoot, signing);
  const dataRoot = DepositDataType.hashTreeRoot({ ...message, signature });

  return {
    pubkey: encodeHex(pubkey),
    withdrawal_credentials: encodeHex(withdrawalCredentials),
    amount,
    signature: encodeHex(signature),
    deposit_message_root: encodeHex(messageRoot),
    deposit_data_root: encodeHex(dataRoot),
    network_name: network.name,
    deposit_cli_version: generatorVersion,
    fork_version: encodeHex(network.forkVersion),
  };
}

/**
 * Verifies canonical validator deposit data.
 *
 * The caller must compute `domain` for the artifact network.
 * The function returns false when metadata, roots, or the signature do not match.
 *
 * @param depositData This object contains canonical validator deposit data.
 * @param domain This value contains the 32-byte deposit signing domain.
 * @returns The function returns true only when all fields, roots, and the signature are valid.
 * @throws The function throws if a hexadecimal field, amount, network, or BLS value is malformed.
 */
export async function verifyValidatorDepositData(
  depositData: ValidatorDepositData,
  domain: Uint8Array
): Promise<boolean> {
  if (
    typeof depositData.amount !== "number" ||
    depositData.network_name !== depositData.network_name.toLowerCase() ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
      depositData.deposit_cli_version
    )
  ) {
    return false;
  }
  if (
    !Number.isSafeInteger(depositData.amount) ||
    depositData.amount < ONE_ETH_GWEI
  ) {
    throw new Error(
      `Validator amount must be a safe integer of at least ${ONE_ETH_GWEI} Gwei`
    );
  }

  const pubkey = decodeHexExact(
    depositData.pubkey,
    48,
    "Validator public key"
  );
  const withdrawalCredentials = decodeHexExact(
    depositData.withdrawal_credentials,
    32,
    "Validator withdrawal credentials"
  );
  const signature = decodeHexExact(
    depositData.signature,
    96,
    "Validator signature"
  );
  if (
    depositData.pubkey !== encodeHex(pubkey) ||
    depositData.withdrawal_credentials !== encodeHex(withdrawalCredentials) ||
    depositData.signature !== encodeHex(signature)
  ) {
    debugLog("Validator hex fields must use lowercase text without a 0x prefix");
    return false;
  }

  const network = getNetworkConfig(depositData.network_name);
  if (depositData.fork_version !== encodeHex(network.forkVersion)) {
    debugLog("Validator fork version does not match the selected network");
    return false;
  }
  const expectedDomain = computeValidatorDepositDomain(network.forkVersion);
  if (!equalBytes(domain, expectedDomain)) {
    debugLog("Validator domain does not match the selected network");
    return false;
  }

  const message = {
    pubkey,
    withdrawalCredentials,
    amount: depositData.amount,
  } as const;
  const expectedMessageRoot = encodeHex(
    DepositMessageType.hashTreeRoot(message)
  );
  const expectedDataRoot = encodeHex(
    DepositDataType.hashTreeRoot({ ...message, signature })
  );
  const independentDataRoot = computeDepositDataRoot(
    depositData.pubkey,
    depositData.withdrawal_credentials,
    depositData.signature,
    depositData.amount
  ).slice(2);

  debugLog("Validator verification", {
    expectedMessageRoot,
    actualMessageRoot: depositData.deposit_message_root,
    expectedDataRoot,
    actualDataRoot: depositData.deposit_data_root,
    independentDataRoot,
  });

  if (
    expectedMessageRoot !== depositData.deposit_message_root ||
    expectedDataRoot !== depositData.deposit_data_root ||
    independentDataRoot !== depositData.deposit_data_root
  ) {
    return false;
  }

  const signingRoot = computeSigningRoot(
    DepositMessageType.hashTreeRoot(message),
    domain
  );
  return verifyBlsProof(signature, signingRoot, pubkey);
}
