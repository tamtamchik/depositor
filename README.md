# Depositor - Ethereum 2.0 Validator Key Generator

[![Latest Version on NPM][ico-version]][link-npm]
[![Tests][ico-tests]][link-tests]
[![Lint][ico-lint]][link-lint]
[![Build][ico-build]][link-build]
[![Code Coverage][ico-codecov]][link-codecov]
[![Total Downloads][ico-downloads]][link-downloads]
[![Software License][ico-license]][link-license]

A modern TypeScript implementation of the Ethereum 2.0 deposit tool built with Node.js 23.

## Features

- ✅ Generate Ethereum 2.0 validator keys
- ✅ Create deposit data for staking
- ✅ Use BIP39 mnemonics for key derivation
- ✅ Support for multiple validators in one run
- ✅ Verification of generated data
- ✅ Support for multiple networks (mainnet, sepolia, hoodi)
- ✅ Support for different withdrawal credential types (BLS, ETH address)
- ✅ High test coverage (100% line, 97.7% branch coverage)
- ✅ Modern codebase with TypeScript and ES Modules
- ✅ Global CLI installation support
- ✅ Programmatic API for use as a library

## Prerequisites

- Node.js (23+)

## Installation

### Global Installation

To install the CLI globally:

```bash
npm install -g @tamtamchik/depositor
```

Then you can use it from anywhere:

```bash
depositor --validators=2 --wc-address=0xYourEthAddress --chain=sepolia --password=YourSecurePassword
```

### Local Installation

1. Clone the repository:

```bash
git clone https://github.com/tamtamchik/depositor.git
cd depositor
```

2. Install dependencies:

```bash
npm install
```

## Usage

### CLI Interface

If installed globally, run directly:

```bash
depositor [options]
```

Or if installed locally:

```bash
npx depositor [options]
```

You can also use the provided npm scripts:

```bash
npm run generate -- [options]
```

### Options

| Option         | Description                                                                    | Default          |
| -------------- | ------------------------------------------------------------------------------ | ---------------- |
| `--mnemonic`   | Mnemonic seed for key generation (optional, will be generated if not provided) |                  |
| `--validators` | Number of validators to generate                                               | 1                |
| `--wc-type`    | Withdrawal credentials type (0=BLS, 1/2=ETH address)                           | 1                |
| `--wc-address` | Ethereum address for withdrawal (required when wc-type is 1 or 2)              |                  |
| `--chain`      | Network chain to use (mainnet, sepolia, hoodi)                                 | mainnet          |
| `--password`   | Password for keystore encryption                                               |                  |
| `--out`        | Output directory for keystores                                                 | ./validator_keys |
| `--verify`     | Whether to verify generated deposit data                                       | true             |
| `--amount`     | Amount in ETH to deposit per validator                                         | 32               |
| `--debug`      | Enable debug logging                                                           | false            |

### Example

Generate 2 validators for sepolia with ETH withdrawal address:

```bash
depositor --validators=2 --wc-address=0xYourEthAddress --chain=sepolia --password=YourSecurePassword
```

## API Usage

You can also use the library programmatically:

### Simple All-in-One Usage

```typescript
import { createDepositData, ONE_ETH_GWEI } from "@tamtamchik/depositor";

// Create deposit data in a single function call
async function main() {
  const depositData = await createDepositData({
    mnemonic: "test test test test test test test test test test test junk", // DO NOT USE IN PRODUCTION
    index: 0, // validator index
    ethAddress: "0x1234567890123456789012345678901234567890",
    network: "mainnet",
    amount: 32n * ONE_ETH_GWEI, // 32 ETH in Gwei
  });

  console.log(depositData);
  // {
  //   pubkey: "...",
  //   withdrawal_credentials: "...",
  //   amount: "32000000000",
  //   signature: "...",
  //   deposit_message_root: "...",
  //   deposit_data_root: "...",
  //   network_name: "mainnet",
  //   deposit_cli_version: "node23-tsx"
  // }
}
```

### Step-by-Step Usage

If you need more control over the process, you can use the individual functions:

```typescript
import {
  generateValidatorKeys,
  buildWithdrawalCredentials,
  generateDepositData,
  verifyDepositData,
  getNetworkConfig,
  ONE_ETH_GWEI,
  // Types
  type DepositData,
  type ValidatorKeys,
} from "@tamtamchik/depositor";

// 1. Generate validator keys (optional - if you want to create key files)
const { signing, pubkey } = await generateValidatorKeys(
  "test test test test test test test test test test test junk", // mnemonic
  0, // validator index
  "YourPassword", // password for keystore
  "./your_output_dir" // output directory for keystore files
);

// 2. Create withdrawal credentials
const withdrawalCredentials = buildWithdrawalCredentials(
  1, // type 1 = ETH address
  pubkey, // public key
  "0x1234567890123456789012345678901234567890" // ETH address
);

// 3. Generate deposit data
const depositData = await generateDepositData(
  pubkey,
  signing,
  withdrawalCredentials,
  32n * ONE_ETH_GWEI, // 32 ETH in Gwei
  "mainnet" // network name
);

// 4. Use the deposit data object in your application
console.log(depositData);
// {
//   pubkey: "...",
//   withdrawal_credentials: "...",
//   amount: "32000000000",
//   signature: "...",
//   deposit_message_root: "...",
//   deposit_data_root: "...",
//   network_name: "mainnet",
//   deposit_cli_version: "node23-tsx"
// }
```

### Available Functions

The library exports the following key functions for programmatic usage:

- **Constants**

  - `ONE_ETH_GWEI`: BigInt constant for 1 ETH in Gwei (1_000_000_000n)
  - `networks`: Object containing network configurations

- **Network Functions**

  - `getNetworkConfig(network)`: Gets configuration for a specific network

- **Key Generation**

  - `generateValidatorKeys(mnemonic, index, password, outputDir)`: Generates and saves validator keys
  - `getValidatorInfo(signing, pubkey, index)`: Logs validator information

- **Deposit Functions**

  - `createDepositData(options)`: All-in-one function that generates keys in memory and returns deposit data
  - `buildWithdrawalCredentials(type, pubkey, address?)`: Creates withdrawal credentials
  - `generateDepositData(pubkey, signing, withdrawalCredentials, amount, network)`: Generates deposit data
  - `verifyDepositData(depositData, domain)`: Verifies deposit data integrity
  - `computeDepositDataRoot(pubkey, withdrawalCredentials, signature, amountETH)`: Computes deposit data root

- **Utility Functions**
  - `sha256(data)`: Computes SHA-256 hash
  - `hex(bytes)`: Converts Uint8Array to hex string
  - `fromHex(hexString)`: Converts hex string to Uint8Array

For more examples, see the `examples/` directory in the repository.

### Running Examples

The project includes ready-to-run examples:

1. **Files Example** - Demonstrates how to generate keystore files and deposit data files:

```bash
npm run example:files
```

2. **Data Example** - Demonstrates how to generate deposit data objects without creating keystore files:

```bash
npm run example:data
```

These examples demonstrate how to use the library in different scenarios, depending on whether you need to generate files or just work with data objects in memory.

## Project Structure

```
depositor/
├── src/
│   ├── core.ts        # Core functionality and utilities
│   ├── cli.ts         # Command-line interface
│   ├── bin.ts         # Binary entry point
│   ├── types.ts       # Type definitions
│   └── index.ts       # API entry point and exports
├── test/
│   ├── unit/          # Unit tests for core functionality
│   └── integration.test.ts # End-to-end tests
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── .eslintrc.json     # ESLint configuration
```

## Development

### Running Tests

Run unit tests:

```bash
npm test
```

Generate test coverage:

```bash
npm run test:coverage
```

Current coverage metrics:

- Line coverage: 100%
- Branch coverage: 97.7%
- Function coverage: 100%

See the [test README](./test/README.md) for more details about testing.

### Building

Build the TypeScript code:

```bash
npm run build
```

## Publishing

To publish to npm:

```bash
# Login to npm with your account
npm login

# Build the package
npm run build

# For first publish with scoped package
npm publish --access public
```

For subsequent updates:

```bash
# Update version (patch, minor, or major)
npm version patch

# Build and publish
npm run build
npm publish
```

## License

MIT

## Project History

This project started as a refactoring effort to modernize and optimize an Ethereum 2.0 deposit tool. Key improvements included:

1. Consolidating 7 separate files into 3 core files
2. Implementing a modular design with clear separation of concerns
3. Adding comprehensive test coverage (100% line coverage)
4. Modernizing the codebase with TypeScript and ES Modules
5. Enhancing developer experience with better error handling and documentation
6. Adding support for debugging and verification
7. Providing both CLI and programmatic API interfaces

[ico-tests]: https://img.shields.io/github/actions/workflow/status/tamtamchik/depositor/test.yml?branch=main&style=flat-square&label=tests
[ico-lint]: https://img.shields.io/github/actions/workflow/status/tamtamchik/depositor/lint.yml?branch=main&style=flat-square&label=lint
[ico-build]: https://img.shields.io/github/actions/workflow/status/tamtamchik/depositor/build.yml?branch=main&style=flat-square&label=build
[ico-codecov]: https://img.shields.io/codecov/c/github/tamtamchik/depositor?style=flat-square
[ico-version]: https://img.shields.io/npm/v/@tamtamchik/depositor.svg?style=flat-square
[ico-downloads]: https://img.shields.io/npm/dt/@tamtamchik/depositor.svg?style=flat-square
[ico-license]: https://img.shields.io/npm/l/@tamtamchik/depositor.svg?style=flat-square
[link-tests]: https://github.com/tamtamchik/depositor/actions/workflows/test.yml
[link-lint]: https://github.com/tamtamchik/depositor/actions/workflows/lint.yml
[link-build]: https://github.com/tamtamchik/depositor/actions/workflows/build.yml
[link-codecov]: https://codecov.io/gh/tamtamchik/depositor
[link-npm]: https://www.npmjs.com/package/@tamtamchik/depositor
[link-downloads]: https://www.npmjs.com/package/@tamtamchik/depositor
[link-license]: ./LICENSE
