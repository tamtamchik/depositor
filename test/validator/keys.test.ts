import assert from "node:assert";
import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  generateValidatorKeys,
  getValidatorPublicInfo,
  hex,
} from "../../src/index.ts";
import { MNEMONIC, PASSWORD } from "../support/harness.ts";

describe("validator keys", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "depositor-validator-keys-"));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("derives EIP-2334 keys and writes a matching EIP-2335 keystore", async () => {
    const result = await generateValidatorKeys(MNEMONIC, 3, PASSWORD, outputDir);
    assert.strictEqual(result.signing.length, 32);
    assert.strictEqual(result.pubkey.length, 48);
    assert.strictEqual(result.path, "m/12381/3600/3/0/0");
    assert.match(result.keystoreFile, /^keystore-m_12381_3600_3_0_0-\d+\.json$/);

    const keystore = JSON.parse(
      await readFile(join(outputDir, result.keystoreFile), "utf8")
    );
    assert.strictEqual(keystore.version, 4);
    assert.strictEqual(keystore.path, result.path);
    assert.strictEqual(keystore.pubkey, hex(result.pubkey));
    assert(keystore.crypto.kdf);
    assert(keystore.crypto.checksum);
    assert(keystore.crypto.cipher);
  });

  it("creates a missing output directory", async () => {
    const nested = join(outputDir, "missing", "nested");
    const result = await generateValidatorKeys(MNEMONIC, 0, PASSWORD, nested);
    await access(join(nested, result.keystoreFile));
  });

  it("derives distinct keys for distinct validator indices", async () => {
    const first = await generateValidatorKeys(MNEMONIC, 0, PASSWORD, outputDir);
    const second = await generateValidatorKeys(MNEMONIC, 1, PASSWORD, outputDir);
    assert.notDeepStrictEqual(first.signing, second.signing);
    assert.notDeepStrictEqual(first.pubkey, second.pubkey);
    assert.notStrictEqual(first.keystoreFile, second.keystoreFile);
  });

  it("never overwrites an existing keystore", async () => {
    const originalNow = Date.now;
    Date.now = () => 1_800_000_000_000;
    try {
      await generateValidatorKeys(MNEMONIC, 0, PASSWORD, outputDir);
      await assert.rejects(
        generateValidatorKeys(MNEMONIC, 0, PASSWORD, outputDir),
        /EEXIST/
      );
      assert.strictEqual((await readdir(outputDir)).length, 1);
    } finally {
      Date.now = originalNow;
    }
  });

  it("rejects unsafe validator indices", async () => {
    for (const index of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(
        generateValidatorKeys(MNEMONIC, index, PASSWORD, outputDir),
        /index must be a non-negative safe integer/
      );
    }
  });

  it("prints public validator information without secret key material", () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    try {
      const pubkey = Uint8Array.of(10, 20, 30, 40, 50);
      getValidatorPublicInfo(pubkey, 5);
      const publicOutput = logs.join("\n");
      assert.match(publicOutput, /Validator #5/);
      assert.match(publicOutput, /Path: m\/12381\/3600\/5\/0\/0/);
      assert.match(publicOutput, /Public Key: 0a141e2832/);
      assert.doesNotMatch(publicOutput, /Signing SK/);
    } finally {
      console.log = originalLog;
    }
  });
});
