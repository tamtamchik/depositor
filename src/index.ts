#!/usr/bin/env -S node --experimental-strip-types

/**
 * Ethereum 2.0 deposit-cli replacement for Node.js 24 and TypeScript
 */


// Export main functionality from core.ts
export * from "./core.ts";
// Export all types from types.ts
export * from "./types.ts";

// Import and run CLI if this is the main module
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { main } from "./cli.ts";

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
