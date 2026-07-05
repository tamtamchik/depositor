# Security Policy

## Supported Versions

Only the latest published version is supported with security fixes.

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Report vulnerabilities through GitHub private vulnerability reporting:

https://github.com/tamtamchik/depositor/security/advisories/new

## Security Notes

This CLI targets testnet validator workflows. It prints the generated mnemonic and validator signing keys to stdout. Shell history, terminal scrollback, CI logs, and shared machines all keep that output, so never run it with production secrets.

The CLI refuses `--chain=mainnet` without `--allow-mainnet`. That flag only removes the guardrail. It does not make stdout logging or local output handling safe for production mainnet use.
