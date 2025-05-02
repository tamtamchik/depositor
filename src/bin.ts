#!/usr/bin/env node

/**
 * Binary executable for the Ethereum 2.0 Depositor CLI
 */

import { main } from "./cli.js";

// Run CLI
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
