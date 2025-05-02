import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { computeDomain, ZERO_HASH } from "@lodestar/state-transition";
import { DOMAIN_DEPOSIT } from "@lodestar/params";

// Import functions to test
import {
  generateValidatorKeys,
  getValidatorInfo,
  generateDepositData,
  verifyDepositData,
  buildWithdrawalCredentials,
  ONE_ETH_GWEI,
  getNetworkConfig,
} from "@/core.js";

describe("Validator and Deposit Generation", () => {
  // Create a temporary directory for tests
  const TEST_DIR = "./test_coverage_keys";
  // Use a fixed mnemonic for testing
  const TEST_MNEMONIC =
    "test test test test test test test test test test test junk";
  // Use a simple password for testing
  const TEST_PASSWORD = "TestPassword123";

  // Create and remove test directory before and after tests
  beforeEach(async () => {
    if (!existsSync(TEST_DIR)) {
      await mkdir(TEST_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("Validator Key Generation", () => {
    it("should generate validator keys and save keystore file", async () => {
      // Generate keys for index 0
      const result = await generateValidatorKeys(
        TEST_MNEMONIC,
        0,
        TEST_PASSWORD,
        TEST_DIR
      );

      // Verify the returned keys
      assert(
        result.signing instanceof Uint8Array,
        "signing key should be a Uint8Array"
      );
      assert(
        result.pubkey instanceof Uint8Array,
        "pubkey should be a Uint8Array"
      );
      assert.strictEqual(
        result.signing.length,
        32,
        "signing key should be 32 bytes"
      );
      assert.strictEqual(result.pubkey.length, 48, "pubkey should be 48 bytes");
      assert.strictEqual(
        result.path,
        "m/12381/3600/0/0/0",
        "path should match expected format"
      );
      assert(
        result.keystoreFile.startsWith("keystore-m_12381_3600_0_0_0-"),
        "keystore filename should match expected format"
      );
    });

    it("should generate different keys for different indices", async () => {
      // Generate keys for two different indices
      const result1 = await generateValidatorKeys(
        TEST_MNEMONIC,
        0,
        TEST_PASSWORD,
        TEST_DIR
      );

      const result2 = await generateValidatorKeys(
        TEST_MNEMONIC,
        1,
        TEST_PASSWORD,
        TEST_DIR
      );

      // Keys should be different for different indices
      assert.notDeepStrictEqual(
        result1.signing,
        result2.signing,
        "signing keys should be different"
      );
      assert.notDeepStrictEqual(
        result1.pubkey,
        result2.pubkey,
        "public keys should be different"
      );
      assert.notStrictEqual(
        result1.keystoreFile,
        result2.keystoreFile,
        "keystore files should be different"
      );
    });
  });

  describe("Validator Info Display", () => {
    it("should log validator information correctly", () => {
      // Create a mock Uint8Array for testing
      const mockSigning = new Uint8Array([1, 2, 3, 4, 5]);
      const mockPubkey = new Uint8Array([10, 20, 30, 40, 50]);
      const testIndex = 5;

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];

      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        // Call the function
        getValidatorInfo(mockSigning, mockPubkey, testIndex);

        // Verify the output
        assert(
          logs.some((log) => log.includes("Validator #5 Values:")),
          "Should log validator index"
        );
        assert(
          logs.some((log) => log.includes("Path: m/12381/3600/5/0/0")),
          "Should log correct path"
        );
        assert(
          logs.some((log) => log.includes("Signing SK: 0102030405")),
          "Should log signing key"
        );
        assert(
          logs.some((log) => log.includes("Public Key: 0a141e2832")),
          "Should log public key"
        );
      } finally {
        // Restore console.log
        console.log = originalLog;
      }
    });
  });

  describe("Deposit Data Generation", () => {
    it("should generate valid deposit data", async () => {
      // Generate keys first
      const { signing, pubkey } = await generateValidatorKeys(
        TEST_MNEMONIC,
        0,
        TEST_PASSWORD,
        TEST_DIR
      );

      // Create withdrawal credentials (type 0 for testing)
      const withdrawalCredentials = buildWithdrawalCredentials(0, pubkey);

      // Generate deposit data
      const amount = ONE_ETH_GWEI * 32; // 32 ETH in Gwei
      const depositData = await generateDepositData(
        pubkey,
        signing,
        withdrawalCredentials,
        amount,
        "mainnet"
      );

      // Verify deposit data fields
      assert.strictEqual(
        typeof depositData.pubkey,
        "string",
        "pubkey should be a hex string"
      );
      assert.strictEqual(
        typeof depositData.withdrawal_credentials,
        "string",
        "withdrawal_credentials should be a hex string"
      );
      assert.strictEqual(
        depositData.amount,
        amount.toString(),
        "amount should match input"
      );
      assert.strictEqual(
        typeof depositData.signature,
        "string",
        "signature should be a hex string"
      );
      assert.strictEqual(
        typeof depositData.deposit_message_root,
        "string",
        "deposit_message_root should be a hex string"
      );
      assert.strictEqual(
        typeof depositData.deposit_data_root,
        "string",
        "deposit_data_root should be a hex string"
      );
      assert.strictEqual(
        depositData.network_name,
        "mainnet",
        "network_name should match input"
      );
      assert.strictEqual(
        depositData.deposit_cli_version,
        "node23-tsx",
        "deposit_cli_version should be set"
      );
    });

    it("should generate unique deposit data for different validators", async () => {
      // Generate keys for two validators
      const validator1 = await generateValidatorKeys(
        TEST_MNEMONIC,
        0,
        TEST_PASSWORD,
        TEST_DIR
      );

      const validator2 = await generateValidatorKeys(
        TEST_MNEMONIC,
        1,
        TEST_PASSWORD,
        TEST_DIR
      );

      // Create withdrawal credentials
      const wc1 = buildWithdrawalCredentials(0, validator1.pubkey);
      const wc2 = buildWithdrawalCredentials(0, validator2.pubkey);

      // Generate deposit data
      const amount = ONE_ETH_GWEI * 32;
      const deposit1 = await generateDepositData(
        validator1.pubkey,
        validator1.signing,
        wc1,
        amount,
        "mainnet"
      );

      const deposit2 = await generateDepositData(
        validator2.pubkey,
        validator2.signing,
        wc2,
        amount,
        "mainnet"
      );

      // Verify they have different values
      assert.notStrictEqual(
        deposit1.pubkey,
        deposit2.pubkey,
        "pubkeys should be different"
      );
      assert.notStrictEqual(
        deposit1.withdrawal_credentials,
        deposit2.withdrawal_credentials,
        "withdrawal credentials should be different"
      );
      assert.notStrictEqual(
        deposit1.signature,
        deposit2.signature,
        "signatures should be different"
      );
      assert.notStrictEqual(
        deposit1.deposit_message_root,
        deposit2.deposit_message_root,
        "message roots should be different"
      );
      assert.notStrictEqual(
        deposit1.deposit_data_root,
        deposit2.deposit_data_root,
        "data roots should be different"
      );
    });
  });

  describe("Deposit Data Verification", () => {
    it("should verify valid deposit data", async () => {
      // Generate keys
      const { signing, pubkey } = await generateValidatorKeys(
        TEST_MNEMONIC,
        0,
        TEST_PASSWORD,
        TEST_DIR
      );

      // Create withdrawal credentials
      const withdrawalCredentials = buildWithdrawalCredentials(0, pubkey);

      // Generate deposit data
      const amount = ONE_ETH_GWEI * 32;
      const depositData = await generateDepositData(
        pubkey,
        signing,
        withdrawalCredentials,
        amount,
        "mainnet"
      );

      // Compute domain for verification
      const networkConfig = getNetworkConfig("mainnet");
      const domain = computeDomain(
        DOMAIN_DEPOSIT,
        networkConfig.forkVersion,
        ZERO_HASH
      );

      // Enable debug mode for coverage of those paths
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = "true";

      try {
        // Verify the deposit data
        const isValid = await verifyDepositData(depositData, domain);
        assert.strictEqual(isValid, true, "Deposit data should be valid");
      } finally {
        // Restore debug setting
        if (originalDebug) {
          process.env.DEBUG = originalDebug;
        } else {
          delete process.env.DEBUG;
        }
      }
    });

    it("should detect invalid deposit data with mismatched roots", async () => {
      // Generate valid deposit data first
      const { signing, pubkey } = await generateValidatorKeys(
        TEST_MNEMONIC,
        0,
        TEST_PASSWORD,
        TEST_DIR
      );

      const withdrawalCredentials = buildWithdrawalCredentials(0, pubkey);
      const amount = ONE_ETH_GWEI * 32;
      const validDepositData = await generateDepositData(
        pubkey,
        signing,
        withdrawalCredentials,
        amount,
        "mainnet"
      );

      // Create an invalid version by modifying the deposit_message_root
      const invalidDepositData = {
        ...validDepositData,
        deposit_message_root:
          "1111111111111111111111111111111111111111111111111111111111111111",
      };

      // Compute domain for verification
      const networkConfig = getNetworkConfig("mainnet");
      const domain = computeDomain(
        DOMAIN_DEPOSIT,
        networkConfig.forkVersion,
        ZERO_HASH
      );

      // Enable debug mode for coverage
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = "true";

      try {
        // Verify the deposit data
        const isValid = await verifyDepositData(invalidDepositData, domain);
        assert.strictEqual(
          isValid,
          false,
          "Modified deposit data should be invalid"
        );
      } finally {
        // Restore debug setting
        if (originalDebug) {
          process.env.DEBUG = originalDebug;
        } else {
          delete process.env.DEBUG;
        }
      }
    });

    it("should detect invalid deposit data with mismatched data root", async () => {
      // Generate valid deposit data first
      const { signing, pubkey } = await generateValidatorKeys(
        TEST_MNEMONIC,
        0,
        TEST_PASSWORD,
        TEST_DIR
      );

      const withdrawalCredentials = buildWithdrawalCredentials(0, pubkey);
      const amount = ONE_ETH_GWEI * 32;
      const validDepositData = await generateDepositData(
        pubkey,
        signing,
        withdrawalCredentials,
        amount,
        "mainnet"
      );

      // Create an invalid version by modifying the deposit_data_root
      const invalidDepositData = {
        ...validDepositData,
        deposit_data_root:
          "2222222222222222222222222222222222222222222222222222222222222222",
      };

      // Compute domain for verification
      const networkConfig = getNetworkConfig("mainnet");
      const domain = computeDomain(
        DOMAIN_DEPOSIT,
        networkConfig.forkVersion,
        ZERO_HASH
      );

      // Enable debug mode for coverage
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = "true";

      try {
        // Verify the deposit data
        const isValid = await verifyDepositData(invalidDepositData, domain);
        assert.strictEqual(
          isValid,
          false,
          "Modified deposit data should be invalid"
        );
      } finally {
        // Restore debug setting
        if (originalDebug) {
          process.env.DEBUG = originalDebug;
        } else {
          delete process.env.DEBUG;
        }
      }
    });
  });
});
