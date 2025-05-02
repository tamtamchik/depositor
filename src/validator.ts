import {
  deriveKeyFromMnemonic,
  deriveEth2ValidatorKeys,
} from "@chainsafe/bls-keygen";
import bls from "@chainsafe/bls/herumi";
import { create as createKeystore } from "@chainsafe/bls-keystore";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hex } from "./utils";

export async function generateValidatorKeys(
  mnemonic: string,
  index: number,
  password: string,
  outputDir: string
) {
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

export function getValidatorInfo(
  signing: Uint8Array,
  pubkey: Uint8Array,
  index: number
) {
  console.log(`\n🔍 Validator #${index} Values:`);
  console.log("----------------");
  console.log(`Path: m/12381/3600/${index}/0/0`);
  console.log(`Signing SK: ${hex(signing)}`);
  console.log(`Public Key: ${hex(pubkey)}`);
  console.log("----------------\n");
}
