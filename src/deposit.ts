import { ssz } from "@lodestar/types/phase0";
import {
  computeDomain,
  computeSigningRoot,
  ZERO_HASH,
} from "@lodestar/state-transition";
import { DOMAIN_DEPOSIT } from "@lodestar/params";
import bls from "@chainsafe/bls/herumi";
import { fromHex, sha256Concat, encodeGweiAsLittleEndian8 } from "./proof";
import { hex } from "./utils";
import { DepositData } from "./types";
import { getNetworkConfig } from "./config";

function debugLog(...args: any[]) {
  if (process.env.DEBUG) {
    console.log(...args);
  }
}

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
  const { fromHexString } = await import("@chainsafe/ssz");
  const { ssz } = await import("@lodestar/types/phase0");
  const bls = await import("@chainsafe/bls/herumi");

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
