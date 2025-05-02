export type WithdrawalCredentialsType = 0 | 1 | 2;

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

export interface CliOptions {
  mnemonic?: string;
  validators: string;
  "wc-type": string;
  address?: string;
  chain: string;
  password: string;
  out: string;
  verify: boolean;
  amount: string;
}
