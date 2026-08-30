# Security Policy

## Supported Versions

Only the latest published version is supported with security fixes.

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Report vulnerabilities through GitHub private vulnerability reporting:

https://github.com/tamtamchik/depositor/security/advisories/new

## Security Notes

The explicit `validator generate` and `builder generate` commands do not print BLS secret keys. Newly generated recovery material requires either `--mnemonic-out` or an explicit `--show-mnemonic` acknowledgement.

All mainnet generation requires `--allow-mainnet`. That flag only removes a guardrail; it does not make local files, mnemonic output, or custody production-safe.

ePBS builder support is research-only:

- No built-in builder profile is marked deployable on a known network.
- An invalid first-deposit proof of possession can forfeit stake, so requests are verified locally before final request/call artifacts are written.
- The normal builder command does not support fork-transition onboarding through the validator deposit contract.
- The `0xB0` builder profile targets only the builder deposit predeploy. Do not send its artifacts to the validator deposit contract.
- The package does not query fork activation or dynamic request fees, connect wallets, sign execution-layer transactions, or broadcast them.
- It does not implement builder bid/envelope signing, exits, remote signers, hardware wallets, threshold signing, key rotation, or production custody.

EIP-2335 keystores are encrypted, but their passwords, recovery material, output directories, backups, and host environment remain the user's responsibility.
