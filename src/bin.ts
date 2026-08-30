#!/usr/bin/env node

import { main } from "./cli.ts";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
