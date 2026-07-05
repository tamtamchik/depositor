import assert from "node:assert";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { main } from "../../src/cli.ts";

const TEST_MNEMONIC =
  "test test test test test test test test test test test junk";
const TEST_PASSWORD = "TestPassword123";

async function withArgv(args: string[], fn: () => Promise<void>) {
  const originalArgv = process.argv;
  process.argv = ["node", "depositor", ...args];
  try {
    await fn();
  } finally {
    process.argv = originalArgv;
  }
}

async function withMutedConsole(fn: () => Promise<void>) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    await fn();
  } finally {
    console.log = originalLog;
  }
}

describe("CLI", () => {
  it("generates hoodi deposit data by default", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "depositor-cli-"));

    try {
      await withMutedConsole(() =>
        withArgv(
          [
            `--mnemonic=${TEST_MNEMONIC}`,
            `--password=${TEST_PASSWORD}`,
            "--wc-type=0",
            `--out=${outputDir}`,
          ],
          main
        )
      );

      const files = await readdir(outputDir);
      const depositDataFile = files.find((file) =>
        file.startsWith("deposit_data-")
      );
      assert(depositDataFile, "deposit data file should be written");

      const depositData = JSON.parse(
        await readFile(join(outputDir, depositDataFile), "utf8")
      );
      assert.strictEqual(depositData.length, 1);
      assert.strictEqual(depositData[0].network_name, "hoodi");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("rejects mainnet unless explicitly allowed", async () => {
    const outputDir = join(tmpdir(), "depositor-cli-mainnet");

    await withArgv(
      [
        `--mnemonic=${TEST_MNEMONIC}`,
        `--password=${TEST_PASSWORD}`,
        "--wc-type=0",
        "--chain=mainnet",
        `--out=${outputDir}`,
      ],
      async () => {
        await assert.rejects(
          main(),
          /--chain=mainnet requires --allow-mainnet/
        );
      }
    );
  });

  it("requires a keystore password", async () => {
    await withArgv(["--wc-type=0"], async () => {
      await assert.rejects(
        main(),
        /--password is required for keystore generation/
      );
    });
  });
});
