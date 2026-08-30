/**
 * Selects the layout of validator withdrawal credentials.
 *
 * Type 0 uses a BLS public key hash.
 * Type 1 uses a standard execution address.
 * Type 2 uses a compounding execution address.
 */
export type ValidatorWithdrawalCredentialsType = 0 | 1 | 2;

/**
 * Contains one 32-byte validator withdrawal credential.
 */
export type ValidatorWithdrawalCredentials = Uint8Array;

/**
 * Contains canonical validator deposit data for JSON output.
 *
 * Hexadecimal fields do not have a `0x` prefix.
 */
export interface ValidatorDepositData {
  /** Contains the 48-byte validator BLS public key as 96 hex characters. */
  pubkey: string;
  /** Contains the 32-byte withdrawal credentials as 64 hex characters. */
  withdrawal_credentials: string;
  /** Gives the deposit amount in Gwei. */
  amount: number;
  /** Contains the 96-byte BLS signature as 192 hex characters. */
  signature: string;
  /** Contains the 32-byte SSZ deposit message root as 64 hex characters. */
  deposit_message_root: string;
  /** Contains the 32-byte SSZ deposit data root as 64 hex characters. */
  deposit_data_root: string;
  /** Gives the network name that the caller selected. */
  network_name: string;
  /** Gives the depositor package version that created the artifact. */
  deposit_cli_version: string;
  /** Contains the 4-byte network fork version as 8 hex characters. */
  fork_version: string;
}

/**
 * Contains one derived validator key pair and its EIP-2335 keystore location.
 */
export interface ValidatorKeys {
  /** Contains the 32-byte BLS secret key. Keep this value secret. */
  signing: Uint8Array;
  /** Contains the 48-byte BLS public key. */
  pubkey: Uint8Array;
  /** Gives the EIP-2334 validator signing-key path. */
  path: string;
  /** Gives the keystore file name relative to the selected output directory. */
  keystoreFile: string;
}
