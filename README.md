<p align="center">
  <img src="https://raw.githubusercontent.com/tamtamchik/depositor/main/assets/banner.png" alt="Depositor" width="100%">
</p>

# @tamtamchik/depositor

[![CI][ico-ci]][link-ci]
[![Latest Version on NPM][ico-version]][link-npm]
[![TypeScript][ico-types]][link-npm]
[![Software License][ico-license]](LICENSE)
[![Total Downloads][ico-downloads]][link-downloads]

Offline Ethereum staking and experimental ePBS key/deposit artifact generator for Node.js 24+. The package has two explicit roles:

- `validator` generates EIP-2335 validator keystores and canonical `deposit_data` JSON.
- `builder` generates an EIP-2335 builder keystore, signed builder deposit request, and EIP-8282 call artifact under an explicit versioned profile.

> [!WARNING]
> Builder support is research-only. No built-in profile is currently marked deployable on mainnet, Sepolia, or Hoodi. The package does not broadcast transactions or query the dynamic request fee.

## Installation

```bash
npm install @tamtamchik/depositor
```

The package is ESM-only and requires Node.js 24 or newer.

## Validator Generation

Use an existing mnemonic without printing it:

```bash
npx @tamtamchik/depositor validator generate \
  --mnemonic="your existing BIP-39 mnemonic" \
  --password="your keystore password" \
  --wc-type=1 \
  --wc-address=0xYourWithdrawalAddress \
  --chain=hoodi
```

Generate new recovery material and write it to an explicit path:

```bash
npx @tamtamchik/depositor validator generate \
  --mnemonic-out=./validator-recovery.txt \
  --password="your keystore password" \
  --wc-type=1 \
  --wc-address=0xYourWithdrawalAddress \
  --chain=hoodi
```

The explicit command writes:

- `keystore-m_12381_3600_<index>_0_0-*.json`
- `deposit_data-*.json` with numeric `amount` and semantic `deposit_cli_version`

Validator keys use the EIP-2334 path `m/12381/3600/<index>/0/0`. Withdrawal credentials `0x00`, `0x01`, and `0x02` are supported. Deposits start at 1 ETH and accept Gwei precision.

## Builder Generation

Builder generation requires a profile, experimental acknowledgement, and an offline-network acknowledgement while no deployment is registered:

```bash
npx @tamtamchik/depositor builder generate \
  --experimental \
  --profile=eip8282-review-2026-08-30 \
  --allow-unsupported-network \
  --mnemonic="your existing BIP-39 mnemonic" \
  --password="your keystore password" \
  --execution-address=0xYourExecutionAddress \
  --amount=1 \
  --chain=hoodi
```

The command writes:

- `builder-keystore-*.json`
- `builder_deposit_request-*.json`
- `builder_deposit_call-*.json`

The same request and call artifact format is used to prepare a builder's first registration or a later top-up. The generator always creates and locally verifies the proof of possession, even though the consensus layer ignores the withdrawal credentials and signature when the builder already exists.

The call artifact contains the expected `to` address and exact 184-byte calldata. `value_wei` remains `null` unless the caller supplies a current fee:

```bash
--request-fee-wei=7
```

When supplied, `value_wei = amount_wei + request_fee_wei`. The package does not check whether that fee is current.

Builder generation derives one EIP-2333 master key from the mnemonic and stores it in an EIP-2335 keystore with an empty `path`. Ethereum currently has no standardized multi-builder derivation hierarchy.

## Compatibility Matrix

| Role/profile | Artifact | Signing domain | Credentials | Destination | Network status |
| --- | --- | --- | --- | --- | --- |
| Validator canonical | `deposit_data-*.json` | `DOMAIN_DEPOSIT` (`0x03000000`) | `0x00`, `0x01`, `0x02` | Validator deposit flow | Mainnet, Sepolia, Hoodi |
| `gloas-v1.7.0-alpha.11` | Builder request/call | `DOMAIN_BUILDER_DEPOSIT` (`0x0e000000`) | Version `0x03` + execution address | `0x0000bFF46984e3725691FA540a8C7589300D8282` | Research-only |
| `eip8282-review-2026-08-30` | Builder request/call | `DOMAIN_BUILDER_DEPOSIT` (`0x0e000000`) | Version `0xB0` + execution address | `0x0000bFF46984e3725691FA540a8C7589300D8282` | Research-only |

Profiles are immutable bundles of source revisions, domains, credential layout, request type, contract address, minimum amount, encoding, and network availability. There is no builder default and no low-level flag for mixing profile fields.

Pinned sources:

- `gloas-v1.7.0-alpha.11`: consensus-specs tag commit `7d5f3348d7b947851861745be9ce0ba30e526531`
- `eip8282-review-2026-08-30`: EIPs commit `889f8c1e26e9b418f83721083098ca225b14fc0b` and consensus-specs commit `3434cc69d695604ea52253e31486f46ba0e36901`

## Library API

### Validator

```typescript
import {
  buildValidatorWithdrawalCredentials,
  computeDomain,
  DOMAIN_DEPOSIT,
  generateValidatorDepositData,
  generateValidatorKeys,
  getNetworkConfig,
  verifyValidatorDepositData,
  ZERO_HASH,
} from "@tamtamchik/depositor";

const { signing, pubkey } = await generateValidatorKeys(
  "your existing mnemonic",
  0,
  "keystore password",
  "./validator_keys"
);
const credentials = buildValidatorWithdrawalCredentials(
  1,
  pubkey,
  "0xYourWithdrawalAddress"
);
const deposit = await generateValidatorDepositData(
  pubkey,
  signing,
  credentials,
  32_000_000_000,
  "hoodi"
);
const network = getNetworkConfig("hoodi");
const domain = computeDomain(
  DOMAIN_DEPOSIT,
  network.forkVersion,
  ZERO_HASH
);
const valid = await verifyValidatorDepositData(deposit, domain);
```

### Builder

```typescript
import {
  buildBuilderCallArtifact,
  encodeBuilderDepositCalldata,
  generateBuilderDepositRequest,
  generateBuilderKeys,
  verifyBuilderDepositRequest,
} from "@tamtamchik/depositor";

const { signing, pubkey } = await generateBuilderKeys(
  "your existing mnemonic",
  "keystore password",
  "./builder_keys"
);
const request = await generateBuilderDepositRequest(
  pubkey,
  signing,
  "0xYourExecutionAddress",
  1_000_000_000n,
  "hoodi",
  "eip8282-review-2026-08-30"
);
const valid = await verifyBuilderDepositRequest(
  request,
  "hoodi",
  "eip8282-review-2026-08-30"
);
const calldata = encodeBuilderDepositCalldata(
  request,
  "eip8282-review-2026-08-30"
);
const call = await buildBuilderCallArtifact(
  request,
  "hoodi",
  "eip8282-review-2026-08-30"
);
```

`BuilderDepositRequest` contains only `pubkey`, `withdrawal_credentials`, `amount`, and `signature`. `encodeBuilderDepositCalldata` uses an 8-byte big-endian amount. `encodeBuilderDepositRequestRecord` emits the corresponding little-endian SSZ/request record.

## Security Boundary

- A bad first builder-deposit proof of possession can cause the request to be ignored while stake is forfeited. Builder artifacts are verified locally before being written.
- The normal builder command does not support fork-transition onboarding through the validator deposit contract.
- The `0xB0` builder profile targets only the builder deposit predeploy. Sending `0xB0` credentials to the validator deposit contract can lock funds.
- No profile is selected implicitly, and unavailable networks require `--allow-unsupported-network`.
- Mainnet additionally requires `--allow-mainnet`.
- The package does not query RPC, determine fork activation, fetch request fees, connect wallets, sign execution-layer transactions, or broadcast them.
- It does not implement builder bids/envelopes, exits, remote signers, hardware wallets, threshold signing, key rotation, or production custody.
- EIP-2335 protects a key with a password, but local files and recovery material still require an audited storage process.

See [SECURITY.md](SECURITY.md) for reporting and operational notes.

## Development

```bash
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm pack --dry-run
```

## License

MIT

[![Buy Me A Coffee][ico-coffee]][link-coffee]

[ico-ci]: https://img.shields.io/github/actions/workflow/status/tamtamchik/depositor/ci.yml?style=flat-square&label=CI
[ico-coffee]: https://img.shields.io/badge/Buy%20Me%20A-Coffee-%236F4E37.svg?style=flat-square
[ico-version]: https://img.shields.io/npm/v/@tamtamchik/depositor.svg?style=flat-square
[ico-license]: https://img.shields.io/github/license/tamtamchik/depositor.svg?style=flat-square
[ico-downloads]: https://img.shields.io/npm/dt/@tamtamchik/depositor.svg?style=flat-square
[ico-types]: https://img.shields.io/npm/types/@tamtamchik/depositor.svg?style=flat-square

[link-ci]: https://github.com/tamtamchik/depositor/actions/workflows/ci.yml
[link-coffee]: https://www.buymeacoffee.com/tamtamchik
[link-npm]: https://www.npmjs.com/package/@tamtamchik/depositor
[link-downloads]: https://www.npmjs.com/package/@tamtamchik/depositor
