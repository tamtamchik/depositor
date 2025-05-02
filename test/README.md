# Tests for Depositor Tool

This directory contains tests for the Ethereum 2.0 deposit data and keystore generation tool.

## Test Structure

- `unit/`: Unit tests for individual modules
  - `core.test.ts`: Tests for the core module including utility functions, proof functions, and deposit data generation
  - `cli.test.ts`: Tests command-line argument parsing and default handling
- `integration.test.ts`: End-to-end test of the validator key and deposit data generation flow

## Test Coverage

The tests cover:

1. **Utility Functions**: Basic functions for handling hex values, addresses, and Ethereum-specific utilities
2. **Cryptographic Operations**: Hash functions, BLS signature verification
3. **Data Serialization**: Conversion of validator data between different formats
4. **Configuration Handling**: Network-specific configurations for different Ethereum networks
5. **CLI Functionality**: Command-line argument handling
6. **End-to-End Flow**: Complete validator key and deposit data generation process

### Coverage Report

The project uses Node.js 23's built-in test coverage functionality. To generate a coverage report:

```bash
npm run test:coverage
```

Current coverage metrics:

- Line coverage: ~83%
- Branch coverage: ~97%
- Function coverage: ~81%

Areas with lower coverage:

- `core.ts`: Certain functions related to validator key generation and deposit data creation

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test file:

```bash
node --import tsx/esm --test test/unit/core.test.ts
```

## Writing New Tests

Tests use Node.js's built-in test runner and assert module. To add a new test:

1. Create a new file in the appropriate directory with a `.test.ts` extension
2. Import the necessary modules:
   ```typescript
   import { describe, it } from "node:test";
   import assert from "node:assert";
   ```
3. Import the modules to test:
   ```typescript
   import { functionToTest } from "../../src/core.js";
   ```
4. Write your tests using the `describe` and `it` functions
5. Use `assert` to check that the function behaves as expected

## Improving Test Coverage

To improve test coverage:

1. Run the coverage report to identify uncovered lines
2. Add tests for the uncovered functionality
3. Focus on critical code paths, especially those related to key generation and deposit verification
