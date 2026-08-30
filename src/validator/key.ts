import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  deriveEth2ValidatorKeys,
  deriveKeyFromMnemonic,
} from "@chainsafe/bls-keygen";
import { create as createKeystore } from "@chainsafe/bls-keystore";

import { getBlsPublicKey } from "../crypto/bls.ts";
import { encodeHex } from "../hex.ts";
import type { ValidatorKeys } from "./types.ts";

/**
 * Derives one validator signing key and writes its EIP-2335 keystore.
 *
 * The function uses the EIP-2334 path `m/12381/3600/index/0/0`.
 * The returned `signing` value contains secret key material.
 * The function creates the keystore exclusively with mode `0600`.
 *
 * @param mnemonic This string contains valid BIP-39 recovery words.
 * @param index This value gives a non-negative validator index.
 * @param password This string protects the EIP-2335 keystore.
 * @param outputDir This path receives the JSON keystore file.
 * @returns The function returns the key pair, derivation path, and file name.
 * @throws The function throws if key derivation, keystore creation, or file output fails.
 */
export async function generateValidatorKeys(
  mnemonic: string,
  index: number,
  password: string,
  outputDir: string
): Promise<ValidatorKeys> {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error("Validator index must be a non-negative safe integer");
  }
  await mkdir(outputDir, { recursive: true });

  const masterSK = deriveKeyFromMnemonic(mnemonic);
  const { signing } = deriveEth2ValidatorKeys(masterSK, index);
  const pubkey = getBlsPublicKey(signing);

  const path = `m/12381/3600/${index}/0/0`;
  const keystore = await createKeystore(password, signing, pubkey, path);
  const timestamp = Date.now();
  const filename = `keystore-${path.replaceAll("/", "_")}-${timestamp}.json`;
  await writeFile(join(outputDir, filename), JSON.stringify(keystore, null, 2), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  return {
    signing,
    pubkey,
    path,
    keystoreFile: filename,
  };
}

/**
 * Writes public validator key details to standard output.
 *
 * This function does not write the BLS secret key.
 *
 * @param pubkey This value contains the 48-byte BLS public key.
 * @param index This value gives the validator derivation index.
 */
export function getValidatorPublicInfo(
  pubkey: Uint8Array,
  index: number
): void {
  console.log(`Validator #${index}`);
  console.log(`Path: m/12381/3600/${index}/0/0`);
  console.log(`Public Key: ${encodeHex(pubkey)}`);
}
