/**
 * Selects one immutable builder compatibility profile.
 */
export type BuilderProfileId =
  | "gloas-v1.7.0-alpha.11"
  | "eip8282-review-2026-08-30";

/**
 * Gives the deployment maturity of a builder profile.
 */
export type BuilderProfileMaturity = "research-only" | "testnet" | "active";

/**
 * Gives the deployment state of a builder profile on one network.
 */
export type BuilderNetworkAvailability =
  | "unavailable"
  | "research-only"
  | "testnet"
  | "active";

/**
 * Identifies one source that defines a builder profile value.
 */
export interface BuilderProfileSource {
  /** Gives a human-readable source name. */
  readonly name: string;
  /** Gives a source URL that identifies fixed content. */
  readonly url: string;
  /** Gives the immutable source commit or release revision. */
  readonly revision: string;
}

/**
 * Defines one immutable set of builder wire-format and deployment values.
 *
 * Use one profile for all operations on an artifact.
 * Do not combine values from different profiles.
 */
export interface BuilderProfile {
  /** Gives the stable profile identifier. */
  readonly id: BuilderProfileId;
  /** Gives the deployment maturity of this profile. */
  readonly maturity: BuilderProfileMaturity;
  /** Gives the last review date in `YYYY-MM-DD` format. */
  readonly reviewedAt: string;
  /** Lists the immutable sources for this profile. */
  readonly sources: readonly BuilderProfileSource[];
  /** Gives the builder registry version as an unsigned integer. */
  readonly builderVersion: number;
  /** Gives the first byte of builder withdrawal credentials. */
  readonly withdrawalCredentialVersion: number;
  /** Gives the 4-byte builder deposit domain type with a `0x` prefix. */
  readonly domainBuilderDeposit: string;
  /** Gives the 4-byte beacon builder domain type with a `0x` prefix. */
  readonly domainBeaconBuilder: string;
  /** Gives the execution request type as an unsigned integer. */
  readonly depositRequestType: number;
  /** Gives the expected builder deposit contract address. */
  readonly depositContractAddress: string;
  /** Gives the minimum builder deposit in Gwei. */
  readonly minimumDepositGwei: bigint;
  /** Gives the minimum dynamic execution request fee in wei. */
  readonly minimumRequestFeeWei: bigint;
  /** Gives the exact builder deposit calldata length in bytes. */
  readonly calldataLength: number;
  /** Maps a lowercase network name to the deployment state for this profile. */
  readonly networkAvailability: Readonly<
    Record<string, BuilderNetworkAvailability>
  >;
}

/**
 * Contains one builder key pair and its EIP-2335 keystore location.
 */
export interface BuilderKeys {
  /** Contains the 32-byte BLS secret key. Keep this value secret. */
  signing: Uint8Array;
  /** Contains the 48-byte BLS public key. */
  pubkey: Uint8Array;
  /** Confirms that the current builder key policy uses no derivation path. */
  path: "";
  /** Gives the keystore file name relative to the selected output directory. */
  keystoreFile: string;
}

/**
 * Contains a signed builder deposit request and its compatibility metadata.
 *
 * Hexadecimal fields do not have a `0x` prefix unless their field comment
 * specifies the prefix.
 */
export interface BuilderDepositRequest {
  /** Gives the profile that defines every request value. */
  spec_profile: BuilderProfileId;
  /** Gives the maturity of the selected profile. */
  profile_maturity: BuilderProfileMaturity;
  /** Gives the selected profile review date in `YYYY-MM-DD` format. */
  profile_reviewed_at: string;
  /** Lists the immutable sources of the selected profile. */
  profile_sources: readonly BuilderProfileSource[];
  /** Gives the builder registry version. */
  builder_version: number;
  /** Gives the credential version as one byte with a `0x` prefix. */
  withdrawal_credential_version: string;
  /** Gives the request type as one byte with a `0x` prefix. */
  deposit_request_type: string;
  /** Gives the expected builder deposit contract address. */
  deposit_contract_address: string;
  /** Contains the 48-byte builder BLS public key as 96 hex characters. */
  pubkey: string;
  /** Contains the 32-byte builder withdrawal credentials as 64 hex characters. */
  withdrawal_credentials: string;
  /** Gives the lowercase execution withdrawal address with a `0x` prefix. */
  execution_address: string;
  /** Gives the deposit amount in Gwei as a decimal string. */
  amount: string;
  /** Identifies Gwei as the unit of `amount`. */
  amount_unit: "gwei";
  /** Contains the 96-byte BLS proof of possession as 192 hex characters. */
  signature: string;
  /** Contains the 32-byte SSZ message root as 64 hex characters. */
  deposit_message_root: string;
  /** Gives the canonical lowercase signing network name. */
  network_name: string;
  /** Contains the 4-byte network fork version as 8 hex characters. */
  fork_version: string;
  /** Contains the 4-byte builder deposit domain type as 8 hex characters. */
  domain_type: string;
  /** Identifies direct EIP-2333 master-key derivation. */
  key_derivation: "eip2333-master";
  /** Confirms that the current builder key policy uses no derivation path. */
  key_path: "";
}

/**
 * Contains offline execution-call data for one verified builder request.
 *
 * The artifact does not contain a signed transaction.
 */
export interface BuilderCallArtifact {
  /** Gives the profile that defines the call data. */
  spec_profile: BuilderProfileId;
  /** Gives the maturity of the selected profile. */
  profile_maturity: BuilderProfileMaturity;
  /** Gives the canonical lowercase target network name. */
  network_name: string;
  /** Gives the deployment state for the profile and network. */
  network_availability: BuilderNetworkAvailability;
  /** Is true only for an active or testnet deployment. */
  supported_for_submission: boolean;
  /** Gives the expected builder deposit contract address. */
  to: string;
  /** Contains the 184-byte call data as hex with a `0x` prefix. */
  calldata: string;
  /** Gives the decoded call-data length in bytes. */
  calldata_length: number;
  /** Gives the deposit amount in Gwei as a decimal string. */
  amount_gwei: string;
  /** Gives the deposit amount in wei as a decimal string. */
  amount_wei: string;
  /** Confirms that submission requires a dynamic request fee. */
  dynamic_fee_required: true;
  /** Gives the supplied request fee in wei, or null when the fee is unknown. */
  request_fee_wei: string | null;
  /** Gives amount plus fee in wei, or null when the fee is unknown. */
  value_wei: string | null;
}
