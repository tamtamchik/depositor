/**
 * Example of using @tamtamchik/depositor programmatically to generate files
 *
 * This example shows the simplest way to:
 * 1. Generate validator keystore files
 * 2. Generate deposit data file
 * 3. Verify everything works correctly
 */

// For published package use:
// import {
//   generateValidatorKeys,
//   buildWithdrawalCredentials,
//   generateDepositData,
//   verifyDepositData,
//   getNetworkConfig,
//   ONE_ETH_GWEI,
// } from "@tamtamchik/depositor";

// For local development:
import {
  generateValidatorKeys,
  buildWithdrawalCredentials,
  generateDepositData,
  verifyDepositData,
  getNetworkConfig,
  ONE_ETH_GWEI,
} from "../src/index.js";

import { computeDomain, ZERO_HASH } from "@lodestar/state-transition";
import { DOMAIN_DEPOSIT } from "@lodestar/params";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  // Configuration
  const outputDir = "./example_keys";
  const mnemonic =
    "test test test test test test test test test test test junk"; // For demonstration only!
  const password = "ExamplePassword123";
  const ethAddress = "0x1234567890123456789012345678901234567890";
  const network = "sepolia";
  const amountETH = 32n; // in ETH

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  console.log("--- Generating validator files ---");

  // 1. Generate validator keys and save keystore file
  console.log("1. Generating validator keys and saving keystore...");
  const { signing, pubkey, keystoreFile } = await generateValidatorKeys(
    mnemonic,
    0, // validator index
    password,
    outputDir
  );
  console.log(`Generated public key: 0x${Buffer.from(pubkey).toString("hex")}`);
  console.log(`Keystore file saved to: ${join(outputDir, keystoreFile)}`);

  // 2. Create withdrawal credentials (type 1 = ETH address)
  console.log("2. Creating withdrawal credentials...");
  const withdrawalCredentials = buildWithdrawalCredentials(
    1, // type 1 = ETH address
    pubkey,
    ethAddress
  );

  // 3. Generate deposit data
  console.log("3. Generating deposit data...");
  const depositData = await generateDepositData(
    pubkey,
    signing,
    withdrawalCredentials,
    amountETH * ONE_ETH_GWEI, // Convert ETH to Gwei
    network
  );

  // 4. Save deposit data to file
  const depositDataFile = join(outputDir, "deposit_data.json");
  await writeFile(depositDataFile, JSON.stringify([depositData], null, 2));
  console.log(`Deposit data saved to ${depositDataFile}`);

  // 5. Verify deposit data
  console.log("5. Verifying deposit data...");
  const networkConfig = getNetworkConfig(network);
  const domain = computeDomain(
    DOMAIN_DEPOSIT,
    networkConfig.forkVersion,
    ZERO_HASH
  );

  const isValid = await verifyDepositData(depositData, domain);
  console.log(`Verification result: ${isValid ? "✅ Valid" : "❌ Invalid"}`);

  console.log(
    "\nValidator keystore and deposit data files generated successfully!"
  );
  console.log(`Keystore file: ${join(outputDir, keystoreFile)}`);
  console.log(`Deposit data file: ${depositDataFile}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
