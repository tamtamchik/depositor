/**
 * Example of using @tamtamchik/depositor programmatically without creating keystore files
 *
 * This example shows how to:
 * 1. Generate validator keys in memory (no keystore files created)
 * 2. Create withdrawal credentials
 * 3. Generate deposit data
 * 4. Return the deposit data object for use in application code
 */

// For local development (if importing from the project):
import {
  ONE_ETH_GWEI,
  createDepositData,
  getNetworkConfig,
  verifyDepositData,
} from "../src/index.js";

// For published package use:
// import {
//   ONE_ETH_GWEI,
//   createDepositData,
//   getNetworkConfig,
//   verifyDepositData,
// } from "@tamtamchik/depositor";

// Additional dependencies for BLS domain computation
import { computeDomain, ZERO_HASH } from "@lodestar/state-transition";
import { DOMAIN_DEPOSIT } from "@lodestar/params";

// Example usage
async function main() {
  try {
    // Configuration
    const config = {
      mnemonic: "test test test test test test test test test test test junk", // DO NOT USE IN PRODUCTION
      index: 0,
      ethAddress: "0x1234567890123456789012345678901234567890",
      network: "sepolia",
      amount: 32n * ONE_ETH_GWEI, // 32 ETH in Gwei
    };

    console.log("Generating deposit data using in-memory key generation...");

    // Generate deposit data without writing files using the core library function
    const depositData = await createDepositData(config);

    // Display the resulting deposit data
    console.log("\nGenerated Deposit Data:");
    console.log(JSON.stringify(depositData, null, 2));

    // Verify the deposit data
    console.log("\nVerifying deposit data integrity...");
    const networkConfig = getNetworkConfig(config.network);
    const domain = computeDomain(
      DOMAIN_DEPOSIT,
      networkConfig.forkVersion,
      ZERO_HASH
    );

    const isValid = await verifyDepositData(depositData, domain);
    console.log(`Verification result: ${isValid ? "✅ Valid" : "❌ Invalid"}`);

    // Display key deposit data fields
    console.log("\nDeposit Data Fields:");
    console.log(`Network: ${depositData.network_name}`);
    console.log(`Public Key: 0x${depositData.pubkey}`);
    console.log(
      `Withdrawal Credentials: 0x${depositData.withdrawal_credentials}`
    );
    console.log(`Amount: ${BigInt(depositData.amount) / ONE_ETH_GWEI} ETH`);
    console.log(`Deposit Data Root: 0x${depositData.deposit_data_root}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example
main();
