# Tests for Depositor Tool

This directory contains tests for the Ethereum 2.0 deposit data and keystore generation tool.

## Test Structure

- `unit/`: Unit tests for individual modules
  - `core.test.ts`: Tests for the core module including utility functions, proof functions, and deposit data generation
  - `cli.test.ts`: Tests the real CLI defaults, guardrails, and required arguments
  - `generation.test.ts`: Tests for validator key generation, deposit data creation, and verification
- `integration.test.ts`: End-to-end test of the validator key and deposit data generation flow

## Test Coverage

The tests cover:

1. **Utility Functions**: Basic functions for handling hex values, addresses, and Ethereum-specific utilities
2. **Cryptographic Operations**: Hash functions, BLS signature verification
3. **Data Serialization**: Conversion of validator data between different formats
4. **Configuration Handling**: Network-specific configurations for different Ethereum networks
5. **CLI Functionality**: Command execution, defaults, and guardrails
6. **End-to-End Flow**: Complete validator key and deposit data generation process

### Coverage Report

The project uses Node.js 24's built-in test coverage functionality. To generate a coverage report:

```bash
npm run test:coverage
```

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test file:

```bash
node --experimental-strip-types --test test/unit/core.test.ts
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
   import { functionToTest } from "../../src/core.ts";
   ```
4. Write your tests using the `describe` and `it` functions
5. Use `assert` to check that the function behaves as expected

## Maintaining Test Coverage

To maintain high test coverage:

1. Run the coverage report after making changes
2. Add tests for any new functionality
3. Focus on testing both the main path and error paths
4. Use debug flags to validate debug code paths
