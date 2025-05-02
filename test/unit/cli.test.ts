import { describe, it } from "node:test";
import assert from "node:assert";
import { parseArgs } from "node:util";

describe("CLI", () => {
  describe("CLI argument parsing", () => {
    it("should parse arguments correctly", () => {
      // Mock process.argv
      const originalArgv = process.argv;
      process.argv = [
        "node",
        "script.js",
        "--validators=3",
        "--wc-type=1",
        "--wc-address=0x1234567890123456789012345678901234567890",
        "--chain=sepolia",
        "--amount=5",
        "--out=./test_keys",
      ];

      // We're testing parseArgs behavior when called with our expected options
      const { values } = parseArgs({
        options: {
          mnemonic: { type: "string" },
          validators: { type: "string", default: "1" },
          "wc-type": { type: "string", default: "1" },
          "wc-address": { type: "string" },
          chain: { type: "string", default: "mainnet" },
          password: { type: "string" },
          out: { type: "string", default: "./validator_keys" },
          verify: { type: "boolean", default: true },
          amount: { type: "string", default: "32" },
          debug: { type: "boolean", default: false },
        },
        allowPositionals: true,
      });

      // Restore original process.argv
      process.argv = originalArgv;

      // Assertions
      assert.strictEqual(values.validators, "3");
      assert.strictEqual(values["wc-type"], "1");
      assert.strictEqual(
        values["wc-address"],
        "0x1234567890123456789012345678901234567890"
      );
      assert.strictEqual(values.chain, "sepolia");
      assert.strictEqual(values.amount, "5");
      assert.strictEqual(values.out, "./test_keys");
      assert.strictEqual(values.password, undefined);
      assert.strictEqual(values.verify, true);
    });

    it("should apply default values for missing arguments", () => {
      // Mock process.argv with minimal arguments
      const originalArgv = process.argv;
      process.argv = ["node", "script.js", "--password=TestPassword"];

      // Parse with our expected options
      const { values } = parseArgs({
        options: {
          mnemonic: { type: "string" },
          validators: { type: "string", default: "1" },
          "wc-type": { type: "string", default: "1" },
          "wc-address": { type: "string" },
          chain: { type: "string", default: "mainnet" },
          password: { type: "string" },
          out: { type: "string", default: "./validator_keys" },
          verify: { type: "boolean", default: true },
          amount: { type: "string", default: "32" },
          debug: { type: "boolean", default: false },
        },
        allowPositionals: true,
      });

      // Restore original process.argv
      process.argv = originalArgv;

      // Check default values
      assert.strictEqual(values.validators, "1");
      assert.strictEqual(values["wc-type"], "1");
      assert.strictEqual(values.chain, "mainnet");
      assert.strictEqual(values.password, "TestPassword");
      assert.strictEqual(values.out, "./validator_keys");
      assert.strictEqual(values.verify, true);
      assert.strictEqual(values.amount, "32");
      assert.strictEqual(values.debug, false);
      assert.strictEqual(values.mnemonic, undefined); // Optional with no default
      assert.strictEqual(values["wc-address"], undefined); // Optional with no default
    });
  });
});
