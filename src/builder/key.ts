import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { deriveKeyFromMnemonic } from "@chainsafe/bls-keygen";
import { create as createKeystore } from "@chainsafe/bls-keystore";

import { getBlsPublicKey } from "../crypto/bls.ts";
import { parseAddress } from "../hex.ts";
import { getBuilderProfile } from "./profiles.ts";
import type { BuilderKeys, BuilderProfileId } from "./types.ts";

/**
 * Creates 32-byte builder withdrawal credentials for one profile.
 *
 * Byte 0 contains the profile credential version.
 * Bytes 12 through 31 contain the execution address.
 *
 * @param executionAddress This string contains a 20-byte address with a `0x` prefix.
 * @param profileId This value selects the credential format.
 * @returns The function returns new 32-byte withdrawal credentials.
 * @throws The function throws if the profile or address is invalid.
 */
export function buildBuilderWithdrawalCredentials(
  executionAddress: string,
  profileId: BuilderProfileId
): Uint8Array {
  const profile = getBuilderProfile(profileId);
  const credentials = new Uint8Array(32);
  credentials[0] = profile.withdrawalCredentialVersion;
  credentials.set(parseAddress(executionAddress), 12);
  return credentials;
}

/**
 * Derives one builder key and writes its EIP-2335 keystore.
 *
 * The function uses the EIP-2333 master key directly.
 * The EIP-2335 path is an empty string.
 * The returned `signing` value contains secret key material.
 * The function creates the keystore exclusively with mode `0600`.
 *
 * @param mnemonic This string contains valid BIP-39 recovery words.
 * @param password This string protects the EIP-2335 keystore.
 * @param outputDir This path receives the JSON keystore file.
 * @returns The function returns the key pair, empty path, and file name.
 * @throws The function throws if key derivation, keystore creation, or file output fails.
 */
export async function generateBuilderKeys(
  mnemonic: string,
  password: string,
  outputDir: string
): Promise<BuilderKeys> {
  await mkdir(outputDir, { recursive: true });

  const signing = deriveKeyFromMnemonic(mnemonic);
  const pubkey = getBlsPublicKey(signing);
  const path = "" as const;
  const keystore = await createKeystore(password, signing, pubkey, path);
  const filename = `builder-keystore-${Date.now()}.json`;

  await writeFile(join(outputDir, filename), JSON.stringify(keystore, null, 2), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  return { signing, pubkey, path, keystoreFile: filename };
}
