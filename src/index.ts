#!/usr/bin/env -S tsx

/**
 * Ethereum 2.0 deposit-cli replacement for Node.js 23 and TypeScript
 */

// Export all types from types.js
export * from "./types.js";

// Export main functionality from core.js
export * from "./core.js";

// Import and run CLI if this is the main module
import { main } from "./cli.js";

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
