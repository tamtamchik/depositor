#!/usr/bin/env node

/**
 * Command Line Interface for Ethereum 2.0 deposit tool
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
// Node.js built-in imports
import { parseArgs } from "node:util";

// External package imports
import * as bip39 from "@scure/bip39";
import { wordlist as english } from "@scure/bip39/wordlists/english.js";
import {
  buildWithdrawalCredentials,
  computeDomain,
  DOMAIN_DEPOSIT,
  debugLog,
  generateDepositData,
  generateValidatorKeys,
  getNetworkConfig,
  getValidatorInfo,
  ONE_ETH_GWEI,
  verifyDepositData,
  ZERO_HASH,
} from "./core.ts";
// Local imports
import type { CliOptions, WithdrawalCredentialsType } from "./types.ts";

/**
 * Main CLI function
 */
export async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      mnemonic: { type: "string" },
      validators: { type: "string", default: "1" },
      "wc-type": { type: "string", default: "1" },
      "wc-address": { type: "string" },
      chain: { type: "string", default: "mainnet" },
      password: { type: "string" },
      out: { type: "string", default: "./validator_keys" },
      verify: { type: "boolean", default: true },
      amount: { type: "string", default: "32" },
      debug: { type: "boolean", default: false },
    },
    allowPositionals: true,
  }) as { values: CliOptions };

  // Enable debug mode if requested
  if (values.debug) {
    process.env.DEBUG = "true";
  }

  // Debug logging for all values
  debugLog("\n🔍 Debug Values:");
  debugLog("----------------");
  debugLog(`Mnemonic: ${values.mnemonic ? "provided" : "will be generated"}`);
  debugLog(`Number of validators: ${values.validators}`);
  debugLog(`Withdrawal credentials type: ${values["wc-type"]}`);
  debugLog(`Withdrawal address: ${values["wc-address"] || "not provided"}`);
  debugLog(`Chain: ${values.chain}`);
  debugLog(`Output directory: ${values.out}`);
  debugLog(`Verify: ${values.verify}`);
  debugLog(
    `Amount: ${values.amount} ETH (${
      Number(values.amount) * ONE_ETH_GWEI
    } Gwei)`
  );
  debugLog("----------------\n");

  // Parse arguments
  const NUM = Number(values.validators);
  const AMOUNT = Number(values.amount) * ONE_ETH_GWEI;
  const WC_TYPE = Number(values["wc-type"]) as WithdrawalCredentialsType;

  // Validate withdrawal credential type
  if (![0, 1, 2].includes(WC_TYPE))
    throw new Error("--wc-type must be 0, 1, or 2");

  // Validate password is provided
  if (!values.password)
    throw new Error("--password is required for keystore generation");

  // Create output directory
  await mkdir(values.out, { recursive: true });

  // Generate or use provided mnemonic
  const mnemonic = values.mnemonic ?? bip39.generateMnemonic(english, 256);
  console.log(`\n📝  Mnemonic: ${mnemonic}\n`);

  // Get network configuration
  const networkConfig = getNetworkConfig(values.chain);
  const domain = computeDomain(
    DOMAIN_DEPOSIT,
    networkConfig.forkVersion,
    ZERO_HASH
  );

  // Generate validator keys and deposit data
  const depositDataArray = [];

  for (let i = 0; i < NUM; i++) {
    // Generate validator keys
    const { signing, pubkey } = await generateValidatorKeys(
      mnemonic,
      i,
      values.password,
      values.out
    );

    // Log validator information
    getValidatorInfo(signing, pubkey, i);

    // Build withdrawal credentials
    const withdrawalCredentials = buildWithdrawalCredentials(
      WC_TYPE,
      pubkey,
      values["wc-address"]
    );

    // Generate deposit data
    const depositData = await generateDepositData(
      pubkey,
      signing,
      withdrawalCredentials,
      AMOUNT,
      values.chain
    );

    depositDataArray.push(depositData);
  }

  // Write deposit data to file
  const file = join(values.out, `deposit_data-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(depositDataArray, null, 2));
  console.log(`✅  ${NUM} validator(s) written to ${file}`);

  // Verify deposit data if requested
  if (values.verify) {
    console.log("\n🔍 Verifying deposit_data…");
    const buf = await readFile(file, "utf8");
    const items = JSON.parse(buf);
    for (const [idx, depositData] of items.entries()) {
      const isValid = await verifyDepositData(depositData, domain);
      if (!isValid) throw new Error(`Validator #${idx}: verification failed`);
      console.log(`✅ Validator #${idx} verified`);
    }
    console.log("✅ All signatures and roots verified correctly\n");
  }

  console.log(`🔑  Keystores are in ${values.out}\n`);
}

// Run the CLI if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
