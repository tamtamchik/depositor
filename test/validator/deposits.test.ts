import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import packageMetadata from "../../package.json" with { type: "json" };
import type { ValidatorDepositData, ValidatorKeys } from "../../src/index.ts";
import {
  buildValidatorWithdrawalCredentials,
  computeDepositDataRoot,
  computeDomain,
  DepositDataType,
  DOMAIN_DEPOSIT,
  fromHex,
  generateValidatorDepositData,
  generateValidatorKeys,
  getNetworkConfig,
  hex,
  ONE_ETH_GWEI,
  sha256,
  verifyValidatorDepositData,
  ZERO_HASH,
} from "../../src/index.ts";
import {
  EXECUTION_ADDRESS,
  MNEMONIC,
  PASSWORD,
} from "../support/harness.ts";

const GOLDEN_HOODI: ValidatorDepositData = {
  pubkey:
    "b3d60e3322ae02501827ec82b79b4447d37dfe3a41398a0053f23d495c8634993ce8966feaf5f93bed607def4bd9dd29",
  withdrawal_credentials:
    "0200000000000000000000003e5f38ff6686fb8363df1c9a6d68ca61c99a11da",
  amount: 32_000_000_000,
  signature:
    "b094f6c1852596864e4e09dc0dc5f85395399fe2a016518b7e8c2a48297ffefe0ae6a2f22026462363f171d5779f9e4f12005c7842195fe430cd21b20f8c8893d407fca1ac7b37bce66425dba471d0e83b43182c1ad69d923170f7aab2c923a0",
  deposit_message_root:
    "b690134ca3fa749575e91c2959e59388961a639162a8e9aeaee28c2e303655ed",
  deposit_data_root:
    "c480aa78d30175540ae91542870dafb3d6afbb40961ae8ef1c72eb1518ba06ab",
  network_name: "hoodi",
  deposit_cli_version: packageMetadata.version,
  fork_version: "10000910",
};

function domainFor(network: string): Uint8Array {
  return computeDomain(
    DOMAIN_DEPOSIT,
    getNetworkConfig(network).forkVersion,
    ZERO_HASH
  );
}

describe("validator deposits", () => {
  let outputDir: string;
  let primary: ValidatorKeys;
  let secondary: ValidatorKeys;

  before(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "depositor-validator-deposits-"));
    primary = await generateValidatorKeys(MNEMONIC, 0, PASSWORD, outputDir);
    secondary = await generateValidatorKeys(MNEMONIC, 1, PASSWORD, outputDir);
  });

  after(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  describe("withdrawal credentials", () => {
    it("builds BLS, execution, and compounding credentials", () => {
      const bls = buildValidatorWithdrawalCredentials(0, primary.pubkey);
      const expectedBls = new Uint8Array(32);
      expectedBls.set(sha256(primary.pubkey).subarray(1), 1);
      assert.deepStrictEqual(bls, expectedBls);

      const execution = buildValidatorWithdrawalCredentials(
        1,
        primary.pubkey,
        EXECUTION_ADDRESS
      );
      const compounding = buildValidatorWithdrawalCredentials(
        2,
        primary.pubkey,
        EXECUTION_ADDRESS
      );
      assert.strictEqual(
        hex(execution),
        `010000000000000000000000${EXECUTION_ADDRESS.slice(2)}`
      );
      assert.strictEqual(
        hex(compounding),
        `020000000000000000000000${EXECUTION_ADDRESS.slice(2)}`
      );
    });

    it("rejects invalid credential inputs", () => {
      assert.throws(
        () => buildValidatorWithdrawalCredentials(3 as never, primary.pubkey),
        /type must be 0, 1, or 2/
      );
      assert.throws(
        () => buildValidatorWithdrawalCredentials(0, primary.pubkey.slice(1)),
        /public key must be exactly 48 bytes/
      );
      assert.throws(
        () => buildValidatorWithdrawalCredentials(1, primary.pubkey),
        /--wc-address is required/
      );
      assert.throws(
        () => buildValidatorWithdrawalCredentials(2, primary.pubkey, "invalid"),
        /Address must be 0x \+ 40 hex chars/
      );
    });
  });

  describe("artifact formats", () => {
    it("emits canonical numeric validator deposit data", async () => {
      const credentials = buildValidatorWithdrawalCredentials(0, primary.pubkey);
      const canonical = await generateValidatorDepositData(
        primary.pubkey,
        primary.signing,
        credentials,
        ONE_ETH_GWEI,
        "HoOdI"
      );
      assert.strictEqual(canonical.amount, ONE_ETH_GWEI);
      assert.strictEqual(canonical.network_name, "hoodi");
      assert.strictEqual(canonical.deposit_cli_version, packageMetadata.version);
      assert.deepStrictEqual(Object.keys(canonical).sort(), [
        "amount",
        "deposit_cli_version",
        "deposit_data_root",
        "deposit_message_root",
        "fork_version",
        "network_name",
        "pubkey",
        "signature",
        "withdrawal_credentials",
      ]);
      assert.strictEqual(
        await verifyValidatorDepositData(canonical, domainFor("hoodi")),
        true
      );

    });

    it("supports every network and validator credential type", async () => {
      const cases = [
        { network: "mainnet", type: 0, amount: ONE_ETH_GWEI },
        { network: "sepolia", type: 1, amount: 1_500_000_000 },
        { network: "hoodi", type: 2, amount: 32 * ONE_ETH_GWEI },
      ] as const;

      for (const { network, type, amount } of cases) {
        const credentials = buildValidatorWithdrawalCredentials(
          type,
          primary.pubkey,
          type === 0 ? undefined : EXECUTION_ADDRESS
        );
        const artifact = await generateValidatorDepositData(
          primary.pubkey,
          primary.signing,
          credentials,
          amount,
          network
        );
        assert.strictEqual(artifact.amount, amount);
        assert.strictEqual(artifact.network_name, network);
        assert.strictEqual(
          artifact.fork_version,
          hex(getNetworkConfig(network).forkVersion)
        );
        assert.strictEqual(
          await verifyValidatorDepositData(artifact, domainFor(network)),
          true
        );
      }
    });
  });

  describe("SSZ and pinned vectors", () => {
    it("verifies the pinned Hoodi deposit vector", async () => {
      assert.strictEqual(
        await verifyValidatorDepositData(GOLDEN_HOODI, domainFor("hoodi")),
        true
      );
      assert.strictEqual(
        computeDepositDataRoot(
          GOLDEN_HOODI.pubkey,
          GOLDEN_HOODI.withdrawal_credentials,
          GOLDEN_HOODI.signature,
          GOLDEN_HOODI.amount
        ).slice(2),
        GOLDEN_HOODI.deposit_data_root
      );
    });

    it("matches the SSZ deposit data root for fresh data", async () => {
      const credentials = buildValidatorWithdrawalCredentials(
        1,
        primary.pubkey,
        EXECUTION_ADDRESS
      );
      const artifact = await generateValidatorDepositData(
        primary.pubkey,
        primary.signing,
        credentials,
        32 * ONE_ETH_GWEI,
        "hoodi"
      );
      const sszRoot = hex(
        DepositDataType.hashTreeRoot({
          pubkey: primary.pubkey,
          withdrawalCredentials: credentials,
          amount: artifact.amount,
          signature: fromHex(artifact.signature),
        })
      );
      assert.strictEqual(artifact.deposit_data_root, sszRoot);
      assert.strictEqual(
        computeDepositDataRoot(
          artifact.pubkey,
          artifact.withdrawal_credentials,
          artifact.signature,
          BigInt(artifact.amount)
        ).slice(2),
        sszRoot
      );
    });

    it("accepts number and bigint amounts in root calculation", () => {
      const roots = [32_000_000_000, 32_000_000_000n].map(
        (amount) =>
          computeDepositDataRoot(
            GOLDEN_HOODI.pubkey,
            GOLDEN_HOODI.withdrawal_credentials,
            GOLDEN_HOODI.signature,
            amount
          )
      );
      assert.strictEqual(new Set(roots).size, 1);
    });
  });

  describe("local verification", () => {
    it("rejects mismatched metadata, roots, and domains", async () => {
      const credentials = buildValidatorWithdrawalCredentials(0, primary.pubkey);
      const artifact = await generateValidatorDepositData(
        primary.pubkey,
        primary.signing,
        credentials,
        ONE_ETH_GWEI,
        "hoodi"
      );
      const variants = [
        { ...artifact, pubkey: artifact.pubkey.toUpperCase() },
        { ...artifact, network_name: "sepolia" },
        { ...artifact, network_name: "HOODI" },
        { ...artifact, deposit_cli_version: "depositor-cli" },
        { ...artifact, deposit_message_root: "11".repeat(32) },
        { ...artifact, deposit_data_root: "22".repeat(32) },
        { ...artifact, amount: artifact.amount.toString() } as unknown as typeof artifact,
      ];

      for (const variant of variants) {
        assert.strictEqual(
          await verifyValidatorDepositData(variant, domainFor("hoodi")),
          false
        );
      }
      assert.strictEqual(
        await verifyValidatorDepositData(artifact, domainFor("mainnet")),
        false
      );
      assert.strictEqual(
        await verifyValidatorDepositData(
          { ...artifact, deposit_cli_version: "1.2.3-alpha.1+build.5" },
          domainFor("hoodi")
        ),
        true
      );
      await assert.rejects(
        verifyValidatorDepositData(
          { ...artifact, amount: ONE_ETH_GWEI - 1 },
          domainFor("hoodi")
        ),
        /at least 1000000000 Gwei/
      );
    });

    it("rejects a structurally valid artifact with the wrong BLS proof", async () => {
      const credentials = buildValidatorWithdrawalCredentials(0, primary.pubkey);
      const artifact = await generateValidatorDepositData(
        primary.pubkey,
        primary.signing,
        credentials,
        ONE_ETH_GWEI,
        "hoodi"
      );
      const otherCredentials = buildValidatorWithdrawalCredentials(0, secondary.pubkey);
      const other = await generateValidatorDepositData(
        secondary.pubkey,
        secondary.signing,
        otherCredentials,
        ONE_ETH_GWEI,
        "hoodi"
      );
      const invalidProof = {
        ...artifact,
        signature: other.signature,
        deposit_data_root: computeDepositDataRoot(
          artifact.pubkey,
          artifact.withdrawal_credentials,
          other.signature,
          artifact.amount
        ).slice(2),
      };
      assert.strictEqual(
        await verifyValidatorDepositData(invalidProof, domainFor("hoodi")),
        false
      );
    });

  });

  describe("input validation", () => {
    it("rejects invalid key material, credentials, and amounts", async () => {
      const credentials = buildValidatorWithdrawalCredentials(0, primary.pubkey);
      await assert.rejects(
        generateValidatorDepositData(
          primary.pubkey,
          primary.signing,
          credentials,
          ONE_ETH_GWEI - 1,
          "hoodi"
        ),
        /at least 1000000000 Gwei/
      );
      await assert.rejects(
        generateValidatorDepositData(
          primary.pubkey,
          primary.signing.slice(1),
          credentials,
          ONE_ETH_GWEI,
          "hoodi"
        ),
        /secret key must be exactly 32 bytes/
      );
      await assert.rejects(
        generateValidatorDepositData(
          primary.pubkey.slice(1),
          primary.signing,
          credentials,
          ONE_ETH_GWEI,
          "hoodi"
        ),
        /public key must be exactly 48 bytes/
      );
      await assert.rejects(
        generateValidatorDepositData(
          primary.pubkey,
          primary.signing,
          credentials.slice(1) as never,
          ONE_ETH_GWEI,
          "hoodi"
        ),
        /withdrawal credentials must be exactly 32 bytes/
      );

      const mismatchedSigning = primary.signing.slice();
      mismatchedSigning[mismatchedSigning.length - 1] ^= 1;
      await assert.rejects(
        generateValidatorDepositData(
          primary.pubkey,
          mismatchedSigning,
          credentials,
          ONE_ETH_GWEI,
          "hoodi"
        ),
        /public key does not match the secret key/
      );
    });

    it("rejects malformed root inputs and uint64 overflow", () => {
      assert.throws(
        () =>
          computeDepositDataRoot(
            GOLDEN_HOODI.pubkey.slice(2),
            GOLDEN_HOODI.withdrawal_credentials,
            GOLDEN_HOODI.signature,
            GOLDEN_HOODI.amount
          ),
        /public key must be exactly 48 bytes/
      );
      assert.throws(
        () =>
          computeDepositDataRoot(
            GOLDEN_HOODI.pubkey,
            GOLDEN_HOODI.withdrawal_credentials,
            GOLDEN_HOODI.signature,
            1n << 64n
          ),
        /unsigned 64-bit Gwei/
      );
    });
  });
});
