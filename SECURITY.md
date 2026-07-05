# Security Policy

## Supported Versions

Only the latest published version is supported with security fixes.

## Reporting a Vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Report vulnerabilities through GitHub private vulnerability reporting:

https://github.com/tamtamchik/depositor/security/advisories/new

## Security Notes

This CLI is intended for testnet validator workflows. It prints the generated mnemonic and validator signing keys to stdout, so shell history, terminal scrollback, CI logs, and shared machines are not safe places to run it with production secrets.

The CLI refuses `--chain=mainnet` unless `--allow-mainnet` is passed. That flag only removes the guardrail; it does not make stdout logging or local output handling safe for production mainnet use.
