# Depositor - Ethereum 2.0 Validator Key Generator

A modern TypeScript implementation of the Ethereum 2.0 deposit tool built with Node.js 23.

## Features

- ✅ Generate Ethereum 2.0 validator keys
- ✅ Create deposit data for staking
- ✅ Use BIP39 mnemonics for key derivation
- ✅ Support for multiple validators in one run
- ✅ Verification of generated data
- ✅ Support for multiple networks (mainnet, sepolia, hoodi)
- ✅ Support for different withdrawal credential types (BLS, ETH address)
- ✅ High test coverage (>80% line, >97% branch coverage)
- ✅ Modern codebase with TypeScript and ES Modules

## Prerequisites

- Node.js v23+
- npm or yarn

## Installation

1. Clone the repository:

```bash
git clone https://github.com/tamtamchik/depositor.git
cd depositor
```

2. Install dependencies:

```bash
npm install
```

Alternatively, use the setup script:

```bash
./setup.sh
```

## Usage

### CLI Interface

Run the tool directly with `npx tsx`:

```bash
npx tsx src/cli.ts [options]
```

Or use the provided npm scripts:

```bash
npm run generate -- [options]
```

### Options

| Option         | Description                                                                    | Default                |
| -------------- | ------------------------------------------------------------------------------ | ---------------------- |
| `--mnemonic`   | Mnemonic seed for key generation (optional, will be generated if not provided) |                        |
| `--validators` | Number of validators to generate                                               | 1                      |
| `--wc-type`    | Withdrawal credentials type (0=BLS, 1/2=ETH address)                           | 0                      |
| `--address`    | Ethereum address for withdrawal (required when wc-type is 1 or 2)              |                        |
| `--chain`      | Network chain to use (mainnet, sepolia, hoodi)                                 | mainnet                |
| `--password`   | Password for keystore encryption                                               | SuperSecurePassword123 |
| `--out`        | Output directory for keystores                                                 | ./validator_keys       |
| `--verify`     | Whether to verify generated deposit data                                       | true                   |
| `--amount`     | Amount in ETH to deposit per validator                                         | 1                      |
| `--debug`      | Enable debug logging                                                           | false                  |

### Example

Generate 2 validators for sepolia with ETH withdrawal address:

```bash
npm run generate -- --validators=2 --wc-type=1 --address=0xYourEthAddress --chain=sepolia --amount=32
```

## API Usage

You can also use the library programmatically:

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
} from "./src/core.js";

// Generate validator keys
const { signing, pubkey } = await generateValidatorKeys(
  "your mnemonic phrase",
  0, // index
  "password",
  "./keys"
);

// Build withdrawal credentials
const withdrawalCredentials = buildWithdrawalCredentials(
  0, // type
  pubkey
);

// Generate deposit data
const depositData = await generateDepositData(
  pubkey,
  signing,
  withdrawalCredentials,
  32000000000, // 32 ETH in Gwei
  "mainnet"
);

// Verify deposit data
const networkConfig = getNetworkConfig("mainnet");
const domain = computeDomain(
  DOMAIN_DEPOSIT,
  networkConfig.forkVersion,
  ZERO_HASH
);
const isValid = await verifyDepositData(depositData, domain);
```

## Project Structure

```
depositor/
├── src/
│   ├── core.ts        # Core functionality and utilities
│   ├── cli.ts         # Command-line interface
│   ├── types.ts       # Type definitions
│   └── index.ts       # Main entry point and exports
├── test/
│   ├── unit/          # Unit tests for core functionality
│   └── integration.test.ts # End-to-end tests
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── .eslintrc.json     # ESLint configuration
└── setup.sh           # Setup script
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

- Line coverage: ~83%
- Branch coverage: ~97%
- Function coverage: ~81%

See the [test README](./test/README.md) for more details about testing.

### Building

Build the TypeScript code:

```bash
npm run build
```

## License

MIT

## Project History

This project started as a refactoring effort to modernize and optimize an Ethereum 2.0 deposit tool. Key improvements included:

1. Consolidating 7 separate files into 3 core files
2. Implementing a modular design with clear separation of concerns
3. Adding comprehensive test coverage (>96%)
4. Modernizing the codebase with TypeScript and ES Modules
5. Enhancing developer experience with better error handling and documentation
6. Adding support for debugging and verification
