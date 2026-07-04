#!/usr/bin/env node

/**
 * npm bin entrypoint: unconditionally runs the CLI
 */

import { main } from "./cli.ts";

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
