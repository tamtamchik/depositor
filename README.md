<p align="center">
  <img src="assets/banner.png" alt="Depositor" width="100%">
</p>

# @tamtamchik/depositor

[![CI][ico-ci]][link-ci]
[![Latest Version on NPM][ico-version]][link-npm]
[![TypeScript][ico-types]][link-npm]
[![Software License][ico-license]](LICENSE)
[![Total Downloads][ico-downloads]][link-downloads]

Generates Ethereum validator EIP-2335 keystores and `deposit_data-*.json` files from a BIP-39 mnemonic. It is a small Node.js CLI and library for testnet deposit workflows.

> [!IMPORTANT]
> This package is for testnets. The CLI prints the mnemonic and validator signing keys to stdout. The CLI refuses `--chain=mainnet` unless you pass `--allow-mainnet`, but that flag only removes the guardrail. It does not make stdout logging or local file handling safe for production mainnet funds.

## Installation

Use it once from npm:

```bash
npx @tamtamchik/depositor --help
```

Install it in a project:

```bash
npm install @tamtamchik/depositor
```

The package requires Node.js 24 or newer and ships as ESM with TypeScript declarations.

## Quick Start

Generate one hoodi validator with 0x01 withdrawal credentials:

```bash
npx @tamtamchik/depositor \
  --wc-address=0xYourWithdrawalAddress \
  --chain=hoodi \
  --password=YourKeystorePassword
```

The run prints a fresh mnemonic, writes files to `./validator_keys`, and verifies the output:

- `keystore-m_12381_3600_<i>_0_0-<timestamp>.json` for each validator.
- `deposit_data-<timestamp>.json` with one entry per validator.

Save the mnemonic. It is the only way to regenerate the same validator keys.

## CLI Usage

From source:

```bash
git clone https://github.com/tamtamchik/depositor.git
cd depositor
npm install
npm run generate -- \
  --wc-address=0xYourWithdrawalAddress \
  --chain=hoodi \
  --password=YourKeystorePassword
```

More validators from an existing mnemonic:

```bash
npm run generate -- \
  --mnemonic="test test test test test test test test test test test junk" \
  --validators=5 \
  --wc-address=0xYourWithdrawalAddress \
  --chain=hoodi \
  --password=YourKeystorePassword
```

1 ETH top-up deposits to compounding 0x02 credentials:

```bash
npm run generate -- \
  --wc-type=2 \
  --wc-address=0xYourWithdrawalAddress \
  --amount=1 \
  --chain=hoodi \
  --password=YourKeystorePassword
```

## Options

| Option | Description | Default |
| --- | --- | --- |
| `--mnemonic` | BIP-39 phrase to derive keys from; omit to generate a new one | generated |
| `--validators` | Number of validators to generate | `1` |
| `--wc-type` | Withdrawal credentials: `0` BLS, `1` ETH address, `2` compounding | `1` |
| `--wc-address` | Withdrawal address, required for `--wc-type` 1 and 2 | |
| `--chain` | `mainnet`, `sepolia`, or `hoodi` | `hoodi` |
| `--password` | Keystore encryption password, required | |
| `--amount` | Deposit size in ETH per validator | `32` |
| `--out` | Output directory | `./validator_keys` |
| `--verify` | Re-check roots and signatures after generation | `true` |
| `--debug` | Log intermediate values | `false` |
| `--allow-mainnet` | Allow `--chain=mainnet` despite stdout secret logging | `false` |

Keys follow the EIP-2334 path `m/12381/3600/<index>/0/0`, so the same mnemonic and index produce the same validator.

## API

```typescript
import {
  generateValidatorKeys,
  buildWithdrawalCredentials,
  generateDepositData,
  verifyDepositData,
  getNetworkConfig,
  computeDomain,
  ZERO_HASH,
  DOMAIN_DEPOSIT,
} from "@tamtamchik/depositor";
```

- `generateValidatorKeys(mnemonic, index, password, outputDir)` derives a validator keypair and writes an EIP-2335 keystore.
- `buildWithdrawalCredentials(type, pubkey, address?)` builds 0x00, 0x01, or 0x02 withdrawal credentials.
- `generateDepositData(pubkey, signing, withdrawalCredentials, amountGwei, chain)` signs and returns one deposit data entry.
- `verifyDepositData(depositData, domain)` checks roots and the BLS signature.
- `getNetworkConfig(chain)` returns the fork version for `mainnet`, `sepolia`, or `hoodi`.
- `computeDomain(domainType, forkVersion, genesisValidatorsRoot)` computes the consensus signing domain.
- `computeDepositDataRoot(pubkey, withdrawalCredentials, signature, amountGwei)` recomputes a deposit data root.

Minimal library example:

```typescript
const { signing, pubkey } = await generateValidatorKeys(
  "your mnemonic phrase",
  0,
  "password",
  "./keys"
);

const withdrawalCredentials = buildWithdrawalCredentials(
  1,
  pubkey,
  "0xYourWithdrawalAddress"
);

const depositData = await generateDepositData(
  pubkey,
  signing,
  withdrawalCredentials,
  32_000_000_000,
  "hoodi"
);

const { forkVersion } = getNetworkConfig("hoodi");
const domain = computeDomain(DOMAIN_DEPOSIT, forkVersion, ZERO_HASH);
const isValid = await verifyDepositData(depositData, domain);
```

## Compatibility

- Runtime: Node.js 24 or newer.
- Module format: ESM only.
- Networks: `mainnet`, `sepolia`, and `hoodi`.
- Key path: EIP-2334 `m/12381/3600/<index>/0/0`.
- Keystores: EIP-2335 version 4 through `@chainsafe/bls-keystore`.
- Deposit roots: SSZ containers through `@chainsafe/ssz`, with a second manual Merkle root check.
- BLS signatures: `@noble/curves` BLS12-381 proof-of-possession signatures.

Each `deposit_data` entry carries the fields emitted by the official deposit CLI: `pubkey`, `withdrawal_credentials`, `amount`, `signature`, `deposit_message_root`, `deposit_data_root`, `fork_version`, `network_name`, and `deposit_cli_version`.

Two output differences matter for the [staking launchpad](https://launchpad.ethereum.org): `amount` is a JSON string where the launchpad expects a number, and `deposit_cli_version` is not semver. Submitting deposits with your own scripts or contracts works as-is.

## Package Boundary

This package generates local validator keystores and deposit data. It does not submit deposits, connect to beacon or execution nodes, manage validator lifecycle, protect terminal output, rotate secrets, or provide a production mainnet custody workflow.

## Security Notes

- Treat generated mnemonics and validator signing keys as secrets.
- Do not run the CLI in CI, shared terminals, recorded shells, or any environment that stores stdout when real funds are involved.
- Use `--allow-mainnet` only if you have audited your own secret-handling process.
- Keep `validator_keys` and shell history out of public repositories and logs.
- Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/tamtamchik/depositor/security/advisories/new), not public issues.

See [SECURITY.md](SECURITY.md) for the supported version policy and reporting path.

## Development

```bash
npm ci --ignore-scripts
npm run lint
npm test
npm run build
npm pack --dry-run
npm audit --audit-level=moderate
```

## License

[MIT](LICENSE)

[![Buy Me A Coffee][ico-coffee]][link-coffee]

[ico-ci]: https://github.com/tamtamchik/depositor/actions/workflows/ci.yml/badge.svg
[ico-coffee]: https://img.shields.io/badge/Buy%20Me%20A-Coffee-%236F4E37.svg?style=flat-square
[ico-version]: https://img.shields.io/npm/v/@tamtamchik/depositor.svg?style=flat-square
[ico-license]: https://img.shields.io/npm/l/@tamtamchik/depositor.svg?style=flat-square
[ico-downloads]: https://img.shields.io/npm/dt/@tamtamchik/depositor.svg?style=flat-square
[ico-types]: https://img.shields.io/npm/types/@tamtamchik/depositor.svg?style=flat-square

[link-ci]: https://github.com/tamtamchik/depositor/actions/workflows/ci.yml
[link-coffee]: https://www.buymeacoffee.com/tamtamchik
[link-npm]: https://www.npmjs.com/package/@tamtamchik/depositor
[link-downloads]: https://www.npmjs.com/package/@tamtamchik/depositor
