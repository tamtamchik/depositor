import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import * as bip39 from "@scure/bip39";
import { wordlist as english } from "@scure/bip39/wordlists/english.js";

import { ONE_ETH_GWEI, UINT64_MAX } from "../units.ts";

interface MnemonicPolicy {
  mnemonic?: string;
  mnemonicOut?: string;
  display: boolean;
}

interface ResolvedMnemonic {
  value: string;
  writtenTo?: string;
  display: boolean;
}

/**
 * Parses a validator count from decimal CLI text.
 *
 * @param value This string contains a base-10 integer without a sign.
 * @returns The function returns a positive safe integer.
 * @throws The function throws if the value is not a positive safe integer.
 */
export function parseValidatorCount(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error("--validators must be a positive integer");
  }

  const validators = Number(value);
  if (!Number.isSafeInteger(validators) || validators < 1) {
    throw new Error("--validators must be a positive integer");
  }
  return validators;
}

/**
 * Converts an ETH amount from CLI text to Gwei.
 *
 * The input accepts at most nine fractional decimal places.
 * The amount must be at least 1 ETH and fit an unsigned 64-bit Gwei value.
 *
 * @param value This string contains the amount in ETH.
 * @returns The function returns the exact amount in Gwei.
 * @throws The function throws if the syntax, precision, minimum, or range is invalid.
 */
export function parseEthAmountGwei(value: string): bigint {
  if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(value)) {
    throw new Error(
      "--amount must be at least 1 ETH with at most 9 decimal places"
    );
  }

  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > 9) {
    throw new Error(
      "--amount must be at least 1 ETH with at most 9 decimal places"
    );
  }

  const amountGwei =
    BigInt(whole || "0") * BigInt(ONE_ETH_GWEI) +
    BigInt(fraction.padEnd(9, "0") || "0");

  if (amountGwei < BigInt(ONE_ETH_GWEI)) {
    throw new Error(
      "--amount must be at least 1 ETH with at most 9 decimal places"
    );
  }
  if (amountGwei > UINT64_MAX) {
    throw new Error("--amount must fit an unsigned 64-bit Gwei value");
  }
  return amountGwei;
}

/**
 * Converts a validator ETH amount from CLI text to numeric Gwei.
 *
 * The result must fit a JavaScript safe integer because validator SSZ uses a number.
 *
 * @param value This string contains the amount in ETH.
 * @returns The function returns the exact amount in Gwei as a number.
 * @throws The function throws if the amount is invalid or exceeds the safe integer range.
 */
export function parseValidatorAmountGwei(value: string): number {
  const amountGwei = parseEthAmountGwei(value);
  if (amountGwei > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("--amount must not exceed 9007199.254740991 ETH");
  }
  return Number(amountGwei);
}

/**
 * Parses an optional execution request fee from CLI text.
 *
 * @param value This string contains a non-negative base-10 amount in wei.
 * The value can be undefined when the current fee is unknown.
 * @returns The function returns the wei amount or undefined.
 * @throws The function throws if a defined value is not a non-negative integer.
 */
export function parseRequestFeeWei(
  value: string | undefined
): bigint | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new Error("--request-fee-wei must be a non-negative integer");
  }
  return BigInt(value);
}

/**
 * Resolves supplied or generated BIP-39 recovery material.
 *
 * The function generates 256-bit English BIP-39 recovery material when none is supplied.
 * The function writes a new UTF-8 file with mode `0600` when `mnemonicOut` is set.
 * The function never overwrites an existing recovery file.
 *
 * @param policy This object controls the recovery material source and disclosure destinations.
 * @returns The function returns the recovery material and disclosure decisions.
 * @throws The function throws if generated recovery material has no explicit destination.
 * @throws The function throws if exclusive file creation fails.
 */
export async function resolveMnemonic(
  policy: MnemonicPolicy
): Promise<ResolvedMnemonic> {
  const generated = policy.mnemonic === undefined;
  if (generated && !policy.display && !policy.mnemonicOut) {
    throw new Error(
      "Generating a mnemonic requires --mnemonic-out=<path> or --show-mnemonic"
    );
  }

  const value = policy.mnemonic ?? bip39.generateMnemonic(english, 256);
  if (policy.mnemonicOut) {
    await mkdir(dirname(policy.mnemonicOut), { recursive: true });
    await writeFile(policy.mnemonicOut, `${value}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  }

  return {
    value,
    writtenTo: policy.mnemonicOut,
    display: policy.display,
  };
}
