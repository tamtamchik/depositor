import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Command } from "commander";

import {
  computeValidatorDepositDomain,
  getNetworkConfig,
} from "../consensus.ts";
import { debugLog } from "../debug.ts";
import { parseAddress } from "../hex.ts";
import {
  generateValidatorDepositArtifact,
  verifyValidatorDepositData,
} from "../validator/deposit.ts";
import { generateValidatorKeys, getValidatorPublicInfo } from "../validator/key.ts";
import type {
  ValidatorDepositData,
  ValidatorWithdrawalCredentialsType,
} from "../validator/types.ts";
import { buildValidatorWithdrawalCredentials } from "../validator/withdrawal.ts";
import {
  parseValidatorAmountGwei,
  parseValidatorCount,
  resolveMnemonic,
} from "./shared.ts";
import type {
  ValidatorCliOptions,
} from "./types.ts";

interface ValidatorCommandOptions {
  mnemonic?: string;
  validators: string;
  wcType: string;
  wcAddress?: string;
  chain: string;
  password?: string;
  out: string;
  verify: boolean;
  amount: string;
  debug: boolean;
  allowMainnet: boolean;
  showMnemonic: boolean;
  mnemonicOut?: string;
}

/**
 * Adds validator generation options to a Commander command.
 *
 * The function mutates the supplied command.
 *
 * @param command This object receives validator CLI options and defaults.
 * @returns The function returns the same Commander command.
 */
export function addValidatorOptions(command: Command): Command {
  return command
    .option("--mnemonic <words>", "Use existing recovery material")
    .option("--validators <count>", "Number of validators", "1")
    .option("--wc-type <type>", "Withdrawal credentials type: 0, 1, or 2", "1")
    .option("--wc-address <address>", "Execution withdrawal address")
    .option("--chain <name>", "Ethereum network", "hoodi")
    .option("--password <value>", "Keystore password")
    .option("--out <directory>", "Artifact output directory", "./validator_keys")
    .option("--verify", "Verify generated deposit data", true)
    .option("--amount <eth>", "Deposit amount in ETH", "32")
    .option("--debug", "Enable debug output", false)
    .option("--allow-mainnet", "Acknowledge mainnet secret handling", false)
    .option("--show-mnemonic", "Print recovery material", false)
    .option("--mnemonic-out <path>", "Write generated recovery material");
}

/**
 * Converts Commander validator options to the internal CLI option shape.
 *
 * A missing password becomes an empty string for later validation.
 *
 * @param command This object contains parsed validator options.
 * @returns The function returns normalized validator CLI options.
 */
export function validatorOptions(command: Command): ValidatorCliOptions {
  const options = command.opts<ValidatorCommandOptions>();
  return {
    mnemonic: options.mnemonic,
    validators: options.validators,
    "wc-type": options.wcType,
    "wc-address": options.wcAddress,
    chain: options.chain,
    password: options.password ?? "",
    out: options.out,
    verify: options.verify,
    amount: options.amount,
    debug: options.debug,
    "allow-mainnet": options.allowMainnet,
    "show-mnemonic": options.showMnemonic,
    "mnemonic-out": options.mnemonicOut,
  };
}

/**
 * Builds the validator command tree.
 *
 * The returned command contains the canonical `validator generate` workflow.
 * The generator version is written to canonical deposit artifacts.
 * The function does not parse arguments or generate artifacts.
 *
 * @param generatorVersion This string identifies the artifact generator version.
 * @returns The function returns a configured Commander command.
 */
export function createValidatorCommand(generatorVersion: string): Command {
  const command = new Command("validator").description(
    "Generate validator keystores and deposit data"
  );
  command.action(() => {
    throw new Error("Usage: depositor validator generate [options]");
  });
  const generate = addValidatorOptions(
    new Command("generate").description(
      "Generate validator keystores and canonical deposit data"
    )
  );
  generate.action(async () => {
    await runValidator(validatorOptions(generate), generatorVersion);
  });
  return command.addCommand(generate).helpCommand(true);
}

/**
 * Generates validator keystores and signed deposit data.
 *
 * The function writes one keystore per validator and one deposit JSON file.
 * The function can write or display recovery material when the caller requests it.
 * The function restores the previous `DEBUG` environment value before it returns.
 *
 * @param values This object contains normalized validator CLI options.
 * @param generatorVersion This string identifies validator deposit artifacts.
 * @returns The promise resolves after generation and optional verification complete.
 * @throws The function throws if safety policy, input validation, signing, verification, or file output fails.
 */
export async function runValidator(
  values: ValidatorCliOptions,
  generatorVersion: string
): Promise<void> {
  const previousDebug = process.env.DEBUG;
  if (values.debug) process.env.DEBUG = "true";
  try {
    await runValidatorWorkflow(values, generatorVersion);
  } finally {
    if (previousDebug === undefined) delete process.env.DEBUG;
    else process.env.DEBUG = previousDebug;
  }
}

async function runValidatorWorkflow(
  values: ValidatorCliOptions,
  generatorVersion: string
): Promise<void> {
  const validatorCount = parseValidatorCount(values.validators);
  const amount = parseValidatorAmountGwei(values.amount);
  const withdrawalType = Number(
    values["wc-type"]
  ) as ValidatorWithdrawalCredentialsType;
  const chain = values.chain.toLowerCase();

  if (![0, 1, 2].includes(withdrawalType)) {
    throw new Error("--wc-type must be 0, 1, or 2");
  }
  if (!values.password) {
    throw new Error("--password is required for keystore generation");
  }
  if (withdrawalType !== 0) {
    if (!values["wc-address"]) {
      throw new Error("--wc-address is required when --wc-type is 1 or 2");
    }
    parseAddress(values["wc-address"]);
  }

  debugLog("Validator command", {
    validatorCount,
    withdrawalType,
    chain,
    outputDir: values.out,
    amount,
  });

  if (chain === "mainnet" && !values["allow-mainnet"]) {
    throw new Error(
      "--chain=mainnet requires --allow-mainnet because this CLI handles validator secrets"
    );
  }

  const network = getNetworkConfig(chain);
  const mnemonic = await resolveMnemonic({
    mnemonic: values.mnemonic,
    mnemonicOut: values["mnemonic-out"],
    display: values["show-mnemonic"] ?? false,
  });
  await mkdir(values.out, { recursive: true });

  const domain = computeValidatorDepositDomain(network.forkVersion);
  const deposits: ValidatorDepositData[] = [];
  for (let index = 0; index < validatorCount; index++) {
    const keys = await generateValidatorKeys(
      mnemonic.value,
      index,
      values.password,
      values.out
    );
    getValidatorPublicInfo(keys.pubkey, index);

    const credentials = buildValidatorWithdrawalCredentials(
      withdrawalType,
      keys.pubkey,
      values["wc-address"]
    );
    const deposit = await generateValidatorDepositArtifact(
      keys.pubkey,
      keys.signing,
      credentials,
      amount,
      chain,
      generatorVersion
    );
    deposits.push(deposit);
  }

  if (values.verify) {
    for (const [index, deposit] of deposits.entries()) {
      if (!(await verifyValidatorDepositData(deposit, domain))) {
        throw new Error(`Validator #${index}: verification failed`);
      }
    }
  }

  const depositFile = join(values.out, `deposit_data-${Date.now()}.json`);
  await writeFile(depositFile, JSON.stringify(deposits, null, 2), {
    encoding: "utf8",
    flag: "wx",
  });

  if (mnemonic.writtenTo) {
    console.log(`Mnemonic written to ${mnemonic.writtenTo}`);
  }
  if (mnemonic.display) {
    console.log(`\nMnemonic: ${mnemonic.value}\n`);
  }

  console.log(`${validatorCount} validator(s) written to ${depositFile}`);
}
