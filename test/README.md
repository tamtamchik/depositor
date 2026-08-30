# Test architecture

The test tree follows package contracts. It does not mirror individual source files.

| Suite | Contract |
| --- | --- |
| `primitives.test.ts` | Consensus domains, networks, hex, addresses, hashes, Gwei byte order, and debug output |
| `validator/keys.test.ts` | EIP-2334 derivation, EIP-2335 keystores, exclusive writes, and diagnostic output |
| `validator/deposits.test.ts` | Withdrawal credentials, canonical artifacts, SSZ roots, BLS verification, and pinned validator vectors |
| `builder/artifacts.test.ts` | Profiles, key material, pinned builder vectors, protocol encoding, local validation, and domain separation |
| `cli/commands.test.ts` | Explicit validator and builder commands, generated files, safety acknowledgements, and secret handling |
| `conventions.test.ts` | Repository rules for source file names and public API documentation |

`fixtures/` contains immutable protocol vectors. `support/` contains shared test input and output capture helpers. The test glob includes only `*.test.ts`, so support modules do not appear as empty suites.

## Boundaries

- Primitive tests use deterministic values and do not write files.
- Validator key tests own validator keystore filesystem behavior.
- Builder artifact tests own builder cryptography and wire formats.
- CLI tests own command routing and complete command output workflows.
- Test names state the subject, behavior, and expected outcome without `should` prefixes.

## Commands

Run the complete suite:

```bash
npm test
```

Run one contract:

```bash
node --experimental-strip-types --test test/validator/deposits.test.ts
```

Generate line, branch, and function coverage plus `lcov.info`:

```bash
npm run test:coverage
```
