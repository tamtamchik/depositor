import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { computeDomain, ZERO_HASH } from "@lodestar/state-transition";
import { DOMAIN_DEPOSIT } from "@lodestar/params";

// Import from core module
import {
  ONE_ETH_GWEI,
  buildWithdrawalCredentials,
  generateValidatorKeys,
  generateDepositData,
  verifyDepositData,
  getNetworkConfig,
} from "@/core.js";

describe("End-to-end deposit flow", () => {
  const TEST_DIR = "./test_validator_keys";
  const TEST_PASSWORD = "TestPassword123";
  const TEST_CHAIN = "mainnet";

  // Will be set in before hook
  let mnemonic: string;
  let depositDataFile: string;

  before(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });

    // Generate a deterministic mnemonic for tests
    mnemonic = "test test test test test test test test test test test junk";
  });

  after(async () => {
    // Clean up test directory after tests
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should generate and verify deposit data", async () => {
    // Generate validator keys
    const { signing, pubkey } = await generateValidatorKeys(
      mnemonic,
      0, // index
      TEST_PASSWORD,
      TEST_DIR
    );

    // Generate withdrawal credentials (type 0 for testing)
    const withdrawalCredentials = buildWithdrawalCredentials(0, pubkey);

    // Generate deposit data
    const amount = ONE_ETH_GWEI * 32n; // 32 ETH in Gwei
    const depositData = await generateDepositData(
      pubkey,
      signing,
      withdrawalCredentials,
      amount,
      TEST_CHAIN
    );

    // Save deposit data to file
    depositDataFile = join(TEST_DIR, "test_deposit_data.json");
    await writeFile(depositDataFile, JSON.stringify([depositData], null, 2));

    // Verify the deposit data
    const networkConfig = getNetworkConfig(TEST_CHAIN);
    const domain = computeDomain(
      DOMAIN_DEPOSIT,
      networkConfig.forkVersion,
      ZERO_HASH
    );

    const isValid = await verifyDepositData(depositData, domain);
    assert.strictEqual(isValid, true, "Deposit data should be valid");

    // Read back the deposit data file and check its format
    const fileContent = await readFile(depositDataFile, "utf8");
    const parsedData = JSON.parse(fileContent);

    assert(Array.isArray(parsedData), "Deposit data should be an array");
    assert.strictEqual(
      parsedData.length,
      1,
      "Should have one deposit data item"
    );

    const savedDepositData = parsedData[0];

    // Verify deposit data fields
    assert(savedDepositData.pubkey, "Public key should be present");
    assert(
      savedDepositData.withdrawal_credentials,
      "Withdrawal credentials should be present"
    );
    assert.strictEqual(
      savedDepositData.amount,
      amount.toString(),
      "Amount should match"
    );
    assert(savedDepositData.signature, "Signature should be present");
    assert(
      savedDepositData.deposit_message_root,
      "Deposit message root should be present"
    );
    assert(
      savedDepositData.deposit_data_root,
      "Deposit data root should be present"
    );
    assert.strictEqual(
      savedDepositData.network_name,
      TEST_CHAIN,
      "Network name should match"
    );
  });
});
