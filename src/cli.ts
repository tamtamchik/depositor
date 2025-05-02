#!/usr/bin/env -S tsx
import { parseArgs } from "node:util";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as bip39 from "@scure/bip39";
import { wordlist as english } from "@scure/bip39/wordlists/english";
import { computeDomain, ZERO_HASH } from "@lodestar/state-transition";
import { DOMAIN_DEPOSIT } from "@lodestar/params";
import { generateValidatorKeys, getValidatorInfo } from "./validator";
import { generateDepositData, verifyDepositData } from "./deposit";
import { buildWithdrawalCredentials, ONE_ETH_GWEI } from "./utils";
import { CliOptions, WithdrawalCredentialsType } from "./types";
import { getNetworkConfig } from "./config";

function debugLog(...args: any[]) {
  if (process.env.DEBUG) {
    console.log(...args);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      mnemonic: { type: "string" },
      validators: { type: "string", default: "1" },
      "wc-type": { type: "string", default: "0" },
      address: { type: "string" },
      chain: { type: "string", default: "mainnet" },
      password: { type: "string", default: "SuperSecurePassword123" },
      out: { type: "string", default: "./validator_keys" },
      verify: { type: "boolean", default: true },
      amount: { type: "string", default: "1" },
      debug: { type: "boolean", default: false },
    },
    allowPositionals: true,
  }) as { values: CliOptions & { debug: boolean } };

  if (values.debug) {
    process.env.DEBUG = "true";
  }

  // Debug logging for all values
  debugLog("\n🔍 Debug Values:");
  debugLog("----------------");
  debugLog(`Mnemonic: ${values.mnemonic ? "provided" : "will be generated"}`);
  debugLog(`Number of validators: ${values.validators}`);
  debugLog(`Withdrawal credentials type: ${values["wc-type"]}`);
  debugLog(`Withdrawal address: ${values.address || "not provided"}`);
  debugLog(`Chain: ${values.chain}`);
  debugLog(`Output directory: ${values.out}`);
  debugLog(`Verify: ${values.verify}`);
  debugLog(
    `Amount: ${values.amount} ETH (${
      Number(values.amount) * ONE_ETH_GWEI
    } Gwei)`
  );
  debugLog("----------------\n");

  const NUM = Number(values.validators);
  const AMOUNT = Number(values.amount) * ONE_ETH_GWEI;
  const WC_TYPE = Number(values["wc-type"]) as WithdrawalCredentialsType;
  if (![0, 1, 2].includes(WC_TYPE))
    throw new Error("--wc-type must be 0, 1, or 2");

  await mkdir(values.out, { recursive: true });

  const mnemonic = values.mnemonic ?? bip39.generateMnemonic(english);
  console.log(`\n📝  Mnemonic: ${mnemonic}\n`);

  // Get network configuration
  const networkConfig = getNetworkConfig(values.chain);
  const domain = computeDomain(
    DOMAIN_DEPOSIT,
    networkConfig.forkVersion,
    ZERO_HASH
  );

  const depositDataArray: any[] = [];

  for (let i = 0; i < NUM; i++) {
    const { signing, pubkey } = await generateValidatorKeys(
      mnemonic,
      i,
      values.password,
      values.out
    );

    getValidatorInfo(signing, pubkey, i);

    const withdrawalCredentials = buildWithdrawalCredentials(
      WC_TYPE,
      pubkey,
      values.address
    );

    const depositData = await generateDepositData(
      pubkey,
      signing,
      withdrawalCredentials,
      AMOUNT,
      values.chain
    );

    depositDataArray.push(depositData);
  }

  const file = join(values.out, `deposit_data-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(depositDataArray, null, 2));
  console.log(`✅  ${NUM} validator(s) written to ${file}`);

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
