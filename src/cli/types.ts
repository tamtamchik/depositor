/**
 * Defines normalized inputs for the validator CLI workflow.
 */
export interface ValidatorCliOptions {
  /** Supplies BIP-39 recovery words, or omits them for generation. */
  mnemonic?: string;
  /** Gives the positive validator count as a decimal string. */
  validators: string;
  /** Gives withdrawal credential type 0, 1, or 2 as a string. */
  "wc-type": string;
  /** Gives the execution withdrawal address for type 1 or type 2. */
  "wc-address"?: string;
  /** Gives a supported Ethereum network name. */
  chain: string;
  /** Gives the EIP-2335 keystore password. */
  password: string;
  /** Gives the artifact output directory. */
  out: string;
  /** Requests local deposit-data verification. */
  verify: boolean;
  /** Gives the deposit amount in ETH with no more than 9 decimal places. */
  amount: string;
  /** Enables diagnostic output when true. */
  debug?: boolean;
  /** Confirms mainnet secret handling when true. */
  "allow-mainnet"?: boolean;
  /** Permits recovery words in standard output when true. */
  "show-mnemonic"?: boolean;
  /** Gives an explicit file for generated recovery words. */
  "mnemonic-out"?: string;
  /** Requests command help when true. */
  help?: boolean;
}

/**
 * Defines normalized inputs for the experimental builder CLI workflow.
 */
export interface BuilderCliOptions {
  /** Supplies BIP-39 recovery words, or omits them for generation. */
  mnemonic?: string;
  /** Gives the EIP-2335 keystore password. */
  password: string;
  /** Gives the builder execution withdrawal address. */
  "execution-address"?: string;
  /** Gives a supported Ethereum network name. */
  chain: string;
  /** Gives the artifact output directory. */
  out: string;
  /** Gives the builder deposit amount in ETH. */
  amount: string;
  /** Gives an explicit immutable builder profile identifier. */
  profile?: string;
  /** Confirms experimental builder generation when true. */
  experimental?: boolean;
  /** Confirms mainnet generation when true. */
  "allow-mainnet"?: boolean;
  /** Permits offline output for an unavailable network when true. */
  "allow-unsupported-network"?: boolean;
  /** Gives the dynamic execution request fee in wei. */
  "request-fee-wei"?: string;
  /** Permits recovery words in standard output when true. */
  "show-mnemonic"?: boolean;
  /** Gives an explicit file for generated recovery words. */
  "mnemonic-out"?: string;
  /** Requests command help when true. */
  help?: boolean;
}
