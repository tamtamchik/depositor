import { bls12_381 } from "@noble/curves/bls12-381.js";

const blsProofs = bls12_381.longSignatures;
const ETHEREUM_BLS_DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";

function assertLength(
  value: Uint8Array,
  expected: number,
  field: string
): void {
  if (value.length !== expected) {
    throw new Error(`${field} must be exactly ${expected} bytes`);
  }
}

/**
 * Derives an Ethereum BLS public key from a secret key.
 *
 * @param secretKey This value contains the 32-byte BLS secret key.
 * @returns The function returns the compressed 48-byte BLS public key.
 * @throws The function throws if the secret key is invalid.
 */
export function getBlsPublicKey(secretKey: Uint8Array): Uint8Array {
  assertLength(secretKey, 32, "BLS secret key");
  return blsProofs.getPublicKey(secretKey).toBytes();
}

/**
 * Signs an Ethereum consensus signing root with a BLS secret key.
 *
 * The function uses the Ethereum proof-of-possession ciphersuite.
 *
 * @param signingRoot This value contains the 32-byte signing root.
 * @param secretKey This value contains the 32-byte BLS secret key.
 * @returns The function returns the compressed 96-byte BLS signature.
 * @throws The function throws if the secret key or signing root is invalid.
 */
export function signBlsProof(
  signingRoot: Uint8Array,
  secretKey: Uint8Array
): Uint8Array {
  assertLength(signingRoot, 32, "BLS signing root");
  assertLength(secretKey, 32, "BLS secret key");
  return blsProofs
    .sign(blsProofs.hash(signingRoot, ETHEREUM_BLS_DST), secretKey)
    .toBytes();
}

/**
 * Verifies an Ethereum BLS proof-of-possession signature.
 *
 * The function uses the Ethereum proof-of-possession ciphersuite.
 *
 * @param signature This value contains the compressed 96-byte BLS signature.
 * @param signingRoot This value contains the 32-byte signing root.
 * @param publicKey This value contains the compressed 48-byte BLS public key.
 * @returns The function returns true when the signature is valid.
 * @throws The function throws if a BLS value has an invalid encoding.
 */
export function verifyBlsProof(
  signature: Uint8Array,
  signingRoot: Uint8Array,
  publicKey: Uint8Array
): boolean {
  assertLength(signature, 96, "BLS signature");
  assertLength(signingRoot, 32, "BLS signing root");
  assertLength(publicKey, 48, "BLS public key");
  return blsProofs.verify(
    signature,
    blsProofs.hash(signingRoot, ETHEREUM_BLS_DST),
    publicKey
  );
}
