/**
 * Core Types
 */

// Withdrawal credential types (0 = BLS, 1,2 = ETH address based)
export type WithdrawalCredentialsType = 0 | 1 | 2;

// Network configuration
export interface NetworkConfig {
  name: string;
  forkVersion: Uint8Array;
}

// Deposit data structure
export interface DepositData {
  pubkey: string;
  withdrawal_credentials: string;
  amount: string;
  signature: string;
  deposit_message_root: string;
  deposit_data_root: string;
  network_name: string;
  deposit_cli_version: string;
}

// Validator key information
export interface ValidatorKeys {
  signing: Uint8Array;
  pubkey: Uint8Array;
  path: string;
  keystoreFile: string;
}

/**
 * CLI Options
 */
export interface CliOptions {
  mnemonic?: string;
  validators: string;
  "wc-type": string;
  "wc-address"?: string;
  chain: string;
  password: string;
  out: string;
  verify: boolean;
  amount: string;
  debug?: boolean;
}
