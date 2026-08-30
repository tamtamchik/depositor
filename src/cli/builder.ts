import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Command } from "commander";

import { buildBuilderCallArtifact } from "../builder/call.ts";
import {
  buildBuilderWithdrawalCredentials,
  generateBuilderKeys,
} from "../builder/key.ts";
import { getBuilderProfile } from "../builder/profiles.ts";
import {
  generateBuilderDepositRequest,
  verifyBuilderDepositRequest,
} from "../builder/request.ts";
import {
  validateBuilderAmount,
  validateRequestFee,
} from "../builder/validation.ts";
import { getNetworkConfig } from "../consensus.ts";
import {
  parseEthAmountGwei,
  parseRequestFeeWei,
  resolveMnemonic,
} from "./shared.ts";
import type { BuilderCliOptions } from "./types.ts";

interface BuilderCommandOptions {
  mnemonic?: string;
  password?: string;
  executionAddress?: string;
  chain: string;
  out: string;
  amount: string;
  profile?: string;
  experimental: boolean;
  allowMainnet: boolean;
  allowUnsupportedNetwork: boolean;
  requestFeeWei?: string;
  showMnemonic: boolean;
  mnemonicOut?: string;
}

function addBuilderOptions(command: Command): Command {
  return command
    .option("--mnemonic <words>", "Use existing recovery material")
    .option("--password <value>", "Keystore password")
    .option("--execution-address <address>", "Builder withdrawal address")
    .option("--chain <name>", "Ethereum network", "hoodi")
    .option("--out <directory>", "Artifact output directory", "./builder_keys")
    .option("--amount <eth>", "Deposit amount in ETH", "1")
    .option("--profile <id>", "Immutable builder compatibility profile")
    .option("--experimental", "Acknowledge experimental builder support", false)
    .option("--allow-mainnet", "Acknowledge mainnet generation", false)
    .option(
      "--allow-unsupported-network",
      "Allow offline artifacts for an unavailable network",
      false
    )
    .option("--request-fee-wei <value>", "Current request fee in wei")
    .option("--show-mnemonic", "Print recovery material", false)
    .option("--mnemonic-out <path>", "Write generated recovery material");
}

function builderOptions(command: Command): BuilderCliOptions {
  const options = command.opts<BuilderCommandOptions>();
  return {
    mnemonic: options.mnemonic,
    password: options.password ?? "",
    "execution-address": options.executionAddress,
    chain: options.chain,
    out: options.out,
    amount: options.amount,
    profile: options.profile,
    experimental: options.experimental,
    "allow-mainnet": options.allowMainnet,
    "allow-unsupported-network": options.allowUnsupportedNetwork,
    "request-fee-wei": options.requestFeeWei,
    "show-mnemonic": options.showMnemonic,
    "mnemonic-out": options.mnemonicOut,
  };
}

/**
 * Builds the experimental builder command tree.
 *
 * The returned command contains the `builder generate` workflow.
 * The function does not parse arguments or generate artifacts.
 *
 * @returns The function returns a configured Commander command.
 */
export function createBuilderCommand(): Command {
  const command = new Command("builder").description(
    "Generate experimental ePBS builder artifacts offline"
  );
  command.action(() => {
    throw new Error("Usage: depositor builder generate [options]");
  });
  const generate = addBuilderOptions(
    new Command("generate").description(
      "Generate a builder keystore, deposit request, and call artifact"
    )
  );
  generate.action(async () => {
    await runBuilder(builderOptions(generate));
  });
  return command.addCommand(generate).helpCommand(true);
}

/**
 * Generates one offline builder key and deposit artifact set.
 *
 * The function writes an EIP-2335 keystore, a signed request, and a call artifact.
 * The function can write or display recovery material when the caller requests it.
 * The function never submits a transaction.
 *
 * @param values This object contains normalized builder CLI options.
 * @returns The promise resolves after all requested files are written.
 * @throws The function throws if safety policy, input validation, signing, verification, or file output fails.
 */
export async function runBuilder(values: BuilderCliOptions): Promise<void> {
  if (!values.experimental) {
    throw new Error("Builder generation requires --experimental");
  }
  if (!values.profile) {
    throw new Error("Builder generation requires --profile=<id>");
  }
  if (!values.password) {
    throw new Error("--password is required for keystore generation");
  }
  if (!values["execution-address"]) {
    throw new Error("--execution-address is required for builder generation");
  }

  const profile = getBuilderProfile(values.profile);
  const chain = values.chain.toLowerCase();
  getNetworkConfig(chain);

  if (chain === "mainnet" && !values["allow-mainnet"]) {
    throw new Error("--chain=mainnet requires --allow-mainnet");
  }

  const availability = profile.networkAvailability[chain] ?? "unavailable";
  if (
    availability !== "active" &&
    availability !== "testnet" &&
    !values["allow-unsupported-network"]
  ) {
    throw new Error(
      `Profile ${profile.id} is ${availability} on ${chain}; offline research generation requires --allow-unsupported-network`
    );
  }

  const amount = parseEthAmountGwei(values.amount);
  validateBuilderAmount(amount, profile);
  buildBuilderWithdrawalCredentials(
    values["execution-address"],
    profile.id
  );
  const requestFeeWei = parseRequestFeeWei(values["request-fee-wei"]);
  if (requestFeeWei !== undefined) {
    validateRequestFee(requestFeeWei, profile);
  }
  const mnemonic = await resolveMnemonic({
    mnemonic: values.mnemonic,
    mnemonicOut: values["mnemonic-out"],
    display: values["show-mnemonic"] ?? false,
  });
  const keys = await generateBuilderKeys(
    mnemonic.value,
    values.password,
    values.out
  );
  const request = await generateBuilderDepositRequest(
    keys.pubkey,
    keys.signing,
    values["execution-address"],
    amount,
    chain,
    profile.id
  );

  if (!(await verifyBuilderDepositRequest(request, profile.id))) {
    throw new Error(
      "Builder proof of possession failed local verification; request artifacts were not written"
    );
  }

  const call = await buildBuilderCallArtifact(request, requestFeeWei);
  const timestamp = Date.now();
  const keystoreFile = join(values.out, keys.keystoreFile);
  const requestFile = join(
    values.out,
    `builder_deposit_request-${timestamp}.json`
  );
  const callFile = join(
    values.out,
    `builder_deposit_call-${timestamp}.json`
  );
  await writeFile(requestFile, JSON.stringify(request, null, 2), {
    encoding: "utf8",
    flag: "wx",
  });
  await writeFile(callFile, JSON.stringify(call, null, 2), {
    encoding: "utf8",
    flag: "wx",
  });

  if (mnemonic.writtenTo) {
    console.log(`Mnemonic written to ${mnemonic.writtenTo}`);
  }
  if (mnemonic.display) {
    console.log(`\nMnemonic: ${mnemonic.value}\n`);
  }
  console.log(`Builder keystore written to ${keystoreFile}`);
  console.log(`Builder deposit request written to ${requestFile}`);
  console.log(`Builder call artifact written to ${callFile}`);
  if (!call.supported_for_submission) {
    console.warn(
      `Research-only artifact: profile ${profile.id} is not marked deployable on ${call.network_name}`
    );
  }
}
