# Depositor

Generates Ethereum validator keystores and `deposit_data-*.json` from a BIP-39 mnemonic. A one-command replacement for `staking-deposit-cli` on testnets.

> [!IMPORTANT]
> **Testnets only.** The tool prints the mnemonic and validator signing keys to stdout. Never point it at real mainnet funds.

## Requirements

Node.js 23 or newer. No build step: the npm scripts run TypeScript through Node's native type stripping.

## Quick start

```bash
git clone https://github.com/tamtamchik/depositor.git
cd depositor
npm install
npm run generate -- \
  --wc-address=0xYourWithdrawalAddress \
  --chain=hoodi \
  --password=YourKeystorePassword
```

The run prints a fresh mnemonic, writes files to `./validator_keys`, and verifies them:

- `keystore-m_12381_3600_<i>_0_0-<timestamp>.json` per validator (EIP-2335, version 4)
- `deposit_data-<timestamp>.json` with one entry per validator, ready for the deposit contract

Save the mnemonic. It is the only way to regenerate the keys.

## Options

| Option         | Description                                                       | Default            |
| -------------- | ----------------------------------------------------------------- | ------------------ |
| `--mnemonic`   | BIP-39 phrase to derive keys from; omit to generate a new one     | generated          |
| `--validators` | Number of validators to generate                                  | `1`                |
| `--wc-type`    | Withdrawal credentials: `0` BLS, `1` ETH address, `2` compounding | `1`                |
| `--wc-address` | Withdrawal address, required for `--wc-type` 1 and 2              |                    |
| `--chain`      | `mainnet`, `sepolia`, or `hoodi`                                  | `mainnet`          |
| `--password`   | Keystore encryption password, required                            |                    |
| `--amount`     | Deposit size in ETH per validator                                 | `32`               |
| `--out`        | Output directory                                                  | `./validator_keys` |
| `--verify`     | Re-check roots and signatures after generation                    | `true`             |
| `--debug`      | Log intermediate values                                           | `false`            |

Keys follow the EIP-2334 path `m/12381/3600/<index>/0/0`, so the same mnemonic and index always yield the same validator.

## Recipes

More validators from an existing mnemonic:

```bash
npm run generate -- \
  --mnemonic="test test test test test test test test test test test junk" \
  --validators=5 \
  --wc-address=0xYourWithdrawalAddress \
  --chain=hoodi \
  --password=YourKeystorePassword
```

1 ETH top-up deposits to compounding (0x02) credentials:

```bash
npm run generate -- \
  --wc-type=2 \
  --wc-address=0xYourWithdrawalAddress \
  --amount=1 \
  --chain=hoodi \
  --password=YourKeystorePassword
```

## Output format

Each `deposit_data` entry carries the fields the official CLI emits: `pubkey`, `withdrawal_credentials`, `amount`, `signature`, `deposit_message_root`, `deposit_data_root`, `fork_version`, `network_name`, `deposit_cli_version`.

Two deviations matter if you feed the file to the [staking launchpad](https://launchpad.ethereum.org): `amount` is a JSON string where the launchpad expects a number, and `deposit_cli_version` is not semver. Submitting deposits with your own scripts or contracts works as-is.

## Verification

With `--verify` (on by default) the tool re-reads the written file and checks every entry three ways: recomputes `deposit_message_root` and `deposit_data_root` with SSZ, recomputes `deposit_data_root` again by manual merkleization, and verifies the BLS signature against the chain's deposit domain. Run with `--debug` to see each value.

## Library usage

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
} from "./src/core.ts";

const { signing, pubkey } = await generateValidatorKeys(
  "your mnemonic phrase",
  0, // key index
  "password",
  "./keys"
);

const withdrawalCredentials = buildWithdrawalCredentials(
  1, // wc-type
  pubkey,
  "0xYourWithdrawalAddress"
);

const depositData = await generateDepositData(
  pubkey,
  signing,
  withdrawalCredentials,
  32_000_000_000, // amount in Gwei
  "hoodi"
);

const { forkVersion } = getNetworkConfig("hoodi");
const domain = computeDomain(DOMAIN_DEPOSIT, forkVersion, ZERO_HASH);
const isValid = await verifyDepositData(depositData, domain);
```

## Development

```bash
npm test              # node:test suite, includes a pinned on-chain hoodi deposit
npm run test:coverage # same suite with lcov output
npm run lint          # biome + tsc --noEmit
npm run build         # emit dist/
```

## License

MIT
