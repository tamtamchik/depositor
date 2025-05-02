/**
 * Core functionality for Ethereum 2.0 validator deposit generation
 */

// Node.js built-in imports
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// External package imports
import { toHexString, fromHexString } from "@chainsafe/ssz";
import { ssz } from "@lodestar/types/phase0";
import {
  computeDomain,
  computeSigningRoot,
  ZERO_HASH,
} from "@lodestar/state-transition";
import { DOMAIN_DEPOSIT } from "@lodestar/params";
import {
  deriveKeyFromMnemonic,
  deriveEth2ValidatorKeys,
} from "@chainsafe/bls-keygen";
import { create as createKeystore } from "@chainsafe/bls-keystore";
import bls from "@chainsafe/bls/herumi";

// Local imports
import type {
  NetworkConfig,
  DepositData,
  WithdrawalCredentialsType,
  ValidatorKeys,
} from "./types.js";

/**
 * ==============================
 * Constants and Network Configs
 * ==============================
 */

// Ethereum amount conversion constant
export const ONE_ETH_GWEI = 1_000_000_000; // 1 ETH = 1e9 Gwei

// Available networks configuration
export const networks: Record<string, NetworkConfig> = {
  mainnet: {
    name: "mainnet",
    forkVersion: Uint8Array.of(0x00, 0x00, 0x00, 0x00),
  },
  sepolia: {
    name: "sepolia",
    forkVersion: Uint8Array.of(0x90, 0x00, 0x00, 0x69),
  },
  hoodi: {
    name: "hoodi",
    forkVersion: Uint8Array.of(0x10, 0x00, 0x09, 0x10),
  },
};

// Debug logging helper
export function debugLog(...args: unknown[]): void {
  if (process.env.DEBUG) {
    console.log(...args);
  }
}

/**
 * ==============================
 * Network Functions
 * ==============================
 */

/**
 * Gets network configuration for the specified chain
 */
export function getNetworkConfig(chain: string): NetworkConfig {
  const config = networks[chain.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported network: ${chain}`);
  }
  return config;
}

/**
 * ==============================
 * Utilities and Encoding
 * ==============================
 */

/**
 * Converts a Uint8Array to a hex string without 0x prefix
 */
export const hex = (u: Uint8Array): string => toHexString(u).slice(2); // strip 0x

/**
 * Computes SHA-256 hash of data
 */
export const sha256 = (d: Uint8Array): Uint8Array =>
  new Uint8Array(createHash("sha256").update(d).digest());

/**
 * Checks if a string is a valid Ethereum address
 */
export const isHexAddr = (a: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(a);

/**
 * Parses an Ethereum address into a Uint8Array
 */
export const parseAddress = (addr: string): Uint8Array => {
  if (!isHexAddr(addr)) throw new Error("Address must be 0x + 40 hex chars");
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++)
    bytes[i] = parseInt(addr.slice(2 + i * 2, 4 + i * 2), 16);
  return bytes;
};

/**
 * Converts a hex string to a Uint8Array
 */
export const fromHex = (hex: string): Uint8Array => {
  if (hex.startsWith("0x")) hex = hex.slice(2);

  // Handle empty strings
  if (hex.length === 0) return new Uint8Array(0);

  // Pad odd-length hex strings with a leading zero
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Computes SHA-256 hash of concatenated inputs
 */
export const sha256Concat = (...inputs: Uint8Array[]): Uint8Array => {
  const hash = createHash("sha256");
  for (const input of inputs) {
    hash.update(input);
  }
  return new Uint8Array(hash.digest());
};

/**
 * Encodes a Gwei amount as a little-endian 8-byte array
 */
export const encodeGweiAsLittleEndian8 = (amountGwei: bigint): Uint8Array => {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number((amountGwei >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
};

/**
 * Builds withdrawal credentials from a pubkey and optional address
 */
export function buildWithdrawalCredentials(
  type: WithdrawalCredentialsType,
  pub: Uint8Array,
  addr?: string
): Uint8Array {
  const out = new Uint8Array(32);
  if (type === 0) {
    out.set(sha256(pub).subarray(1), 1);
  } else {
    if (!addr)
      throw new Error("--wc-address is required when --wc-type is 1 or 2");
    out[0] = type;
    out.set(parseAddress(addr), 12);
  }
  return out;
}

/**
 * ==============================
 * Validator Key Generation
 * ==============================
 */

/**
 * Generates validator signing and public keys from a mnemonic
 */
export async function generateValidatorKeys(
  mnemonic: string,
  index: number,
  password: string,
  outputDir: string
): Promise<ValidatorKeys> {
  const masterSK = deriveKeyFromMnemonic(mnemonic);
  const { signing } = deriveEth2ValidatorKeys(masterSK, index);
  const sk = bls.SecretKey.fromBytes(signing);
  const pubkey = sk.toPublicKey().toBytes();

  const path = `m/12381/3600/${index}/0/0`;
  const keystore = await createKeystore(password, sk.toBytes(), pubkey, path);

  // Create filename with path and timestamp
  const timestamp = Date.now();
  const filename = `keystore-${path.replaceAll("/", "_")}-${timestamp}.json`;
  await writeFile(join(outputDir, filename), JSON.stringify(keystore, null, 2));

  return {
    signing,
    pubkey,
    path,
    keystoreFile: filename,
  };
}

/**
 * Logs validator information to console
 */
export function getValidatorInfo(
  signing: Uint8Array,
  pubkey: Uint8Array,
  index: number
): void {
  console.log(`\n🔍 Validator #${index} Values:`);
  console.log("----------------");
  console.log(`Path: m/12381/3600/${index}/0/0`);
  console.log(`Signing SK: ${hex(signing)}`);
  console.log(`Public Key: ${hex(pubkey)}`);
  console.log("----------------\n");
}

/**
 * ==============================
 * Deposit Data Generation
 * ==============================
 */

/**
 * Computes the deposit data root from the deposit components
 */
export function computeDepositDataRoot(
  pubkey: string,
  withdrawalCredentials: string,
  signature: string,
  amountETH: bigint | string
): string {
  // Convert inputs to bytes
  const pubkeyBytes = fromHex(pubkey);
  const withdrawalCredentialsBytes = fromHex(withdrawalCredentials);
  const signatureBytes = fromHex(signature);

  // Convert amount to Gwei and encode as little-endian
  const amountGwei =
    (typeof amountETH !== "bigint" ? BigInt(amountETH) : amountETH) *
    1_000_000_000n;
  const amountLE64 = encodeGweiAsLittleEndian8(amountGwei);

  // Compute hash tree root components
  const pubkeyRoot = sha256Concat(pubkeyBytes, new Uint8Array(16));

  // Split signature and compute its root
  const sigSlice1 = signatureBytes.slice(0, 64);
  const sigSlice2 = signatureBytes.slice(64);
  const sigSlice1Root = sha256Concat(sigSlice1);
  const sigSlice2Root = sha256Concat(sigSlice2, new Uint8Array(32));
  const signatureRoot = sha256Concat(sigSlice1Root, sigSlice2Root);

  // Combine all parts to compute final root
  const part1 = sha256Concat(pubkeyRoot, withdrawalCredentialsBytes);
  const part2 = sha256Concat(amountLE64, new Uint8Array(24), signatureRoot);
  const depositDataRoot = sha256Concat(part1, part2);

  return "0x" + Buffer.from(depositDataRoot).toString("hex");
}

/**
 * Generates deposit data for a validator
 */
export async function generateDepositData(
  pubkey: Uint8Array,
  signing: Uint8Array,
  withdrawalCredentials: Uint8Array,
  amount: number,
  chain: string
): Promise<DepositData> {
  // Get network configuration
  const networkConfig = getNetworkConfig(chain);

  // Compute domain and create signing key
  const domain = computeDomain(
    DOMAIN_DEPOSIT,
    networkConfig.forkVersion,
    ZERO_HASH
  );
  const sk = bls.SecretKey.fromBytes(signing);

  // Create and sign deposit message
  const depositMsg = { pubkey, withdrawalCredentials, amount } as const;
  const root = computeSigningRoot(ssz.DepositMessage, depositMsg, domain);
  const signature = sk.sign(root).toBytes();

  // Compute roots
  const depositData = { ...depositMsg, signature } as const;
  const msgRoot = ssz.DepositMessage.hashTreeRoot(depositMsg);
  const dataRoot = ssz.DepositData.hashTreeRoot(depositData);

  // Return formatted deposit data
  return {
    pubkey: hex(pubkey),
    withdrawal_credentials: hex(withdrawalCredentials),
    amount: amount.toString(),
    signature: hex(signature),
    deposit_message_root: hex(msgRoot),
    deposit_data_root: hex(dataRoot),
    network_name: chain,
    deposit_cli_version: "node23-tsx",
  };
}

/**
 * Verifies deposit data against the provided domain
 */
export async function verifyDepositData(
  depositData: DepositData,
  domain: Uint8Array
): Promise<boolean> {
  // Convert hex strings to bytes
  const pub = fromHexString("0x" + depositData.pubkey);
  const wc = fromHexString("0x" + depositData.withdrawal_credentials);
  const sig = fromHexString("0x" + depositData.signature);
  const amount = Number(depositData.amount);

  // Create deposit message
  const msg = {
    pubkey: pub,
    withdrawalCredentials: wc,
    amount,
  } as const;

  // Compute expected roots
  const expectMsgRoot = hex(ssz.DepositMessage.hashTreeRoot(msg));
  const expectDataRoot = hex(
    ssz.DepositData.hashTreeRoot({ ...msg, signature: sig })
  );

  // Compute alternative data root for verification
  const altDataRoot = computeDepositDataRoot(
    "0x" + depositData.pubkey,
    "0x" + depositData.withdrawal_credentials,
    "0x" + depositData.signature,
    BigInt(depositData.amount) / 1_000_000_000n
  ).slice(2);

  // Log verification details if debug is enabled
  debugLog("\n🔍 Verification Details:");
  debugLog("----------------");
  debugLog(`Expected Message Root: ${expectMsgRoot}`);
  debugLog(`Actual Message Root:   ${depositData.deposit_message_root}`);
  debugLog(`Expected Data Root:    ${expectDataRoot}`);
  debugLog(`Actual Data Root:      ${depositData.deposit_data_root}`);
  debugLog(`Alternative Data Root: ${altDataRoot}`);
  debugLog("----------------\n");

  // Verify roots match
  if (expectMsgRoot !== depositData.deposit_message_root) {
    debugLog("❌ Message root mismatch");
    return false;
  }
  if (expectDataRoot !== depositData.deposit_data_root) {
    debugLog("❌ Data root mismatch");
    return false;
  }
  if (altDataRoot !== depositData.deposit_data_root) {
    debugLog("❌ Alternative data root mismatch");
    return false;
  }

  // Verify BLS signature
  const r = computeSigningRoot(ssz.DepositMessage, msg, domain);
  const pubkey = bls.PublicKey.fromBytes(pub);
  const signature = bls.Signature.fromBytes(sig);
  const isValid = signature.verify(pubkey, r);

  // Log BLS verification details if debug is enabled
  debugLog("\n🔍 BLS Signature Verification:");
  debugLog("----------------");
  debugLog(`Public Key: ${hex(pub)}`);
  debugLog(`Signature:  ${hex(sig)}`);
  debugLog(`Message:    ${hex(r)}`);
  debugLog(`Valid:      ${isValid}`);
  debugLog("----------------\n");

  return isValid;
}
