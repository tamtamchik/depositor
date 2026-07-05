# Changelog

## 1.0.1 — 2026-07-05

- Default CLI generation now targets hoodi instead of mainnet.
- `--chain=mainnet` now requires explicit `--allow-mainnet`.
- Added security reporting and stdout secret-handling notes.
- CI now verifies the build output and dry-run npm package contents.
- CLI tests now exercise the real `main()` path.

## 1.0.0 — 2026-07-04

First release.

- Validator key generation from a BIP-39 mnemonic (EIP-2333/2334), EIP-2335 v4 keystores.
- `deposit_data` JSON with `fork_version`, matching the official CLI field set.
- Withdrawal credential types 0x00, 0x01, and 0x02; mainnet, sepolia, and hoodi networks.
- Built-in verification: SSZ roots two ways plus BLS signature against the chain domain.
- BLS via `@noble/curves`, SSZ types inlined over `@chainsafe/ssz`, no install scripts, zero audit findings.
- Ships as `@tamtamchik/depositor` on npm: `dist/` built with tsdown (ESM + type declarations), `depositor` bin.
- Requires Node.js 24.
- Spec test suite pinned to a real hoodi deposit.
