#!/usr/bin/env node

/**
 * Ethereum 2.0 deposit-cli replacement for Node.js 23 and TypeScript
 */


// Export main functionality from core.ts
export * from "./core.ts";
// Export all types from types.ts
export * from "./types.ts";

// Import and run CLI if this is the main module
import { main } from "./cli.ts";

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
