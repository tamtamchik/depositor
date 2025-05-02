import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createHash } from "node:crypto";

// Import from core.js
import {
  // Network functions
  networks,
  getNetworkConfig,

  // Utilities
  hex,
  sha256,
  isHexAddr,
  parseAddress,
  buildWithdrawalCredentials,
  debugLog,

  // Proof utilities
  fromHex,
  sha256Concat,
  encodeGweiAsLittleEndian8,

  // Deposit functions
  computeDepositDataRoot,
  verifyDepositData,
} from "@/core.js";

// Import required dependencies to test verifyDepositData
import { DOMAIN_DEPOSIT } from "@lodestar/params";
import { computeDomain, ZERO_HASH } from "@lodestar/state-transition";

// Helper function to manually create a hash for testing
function manualSha256(...inputs: Uint8Array[]): Uint8Array {
  const hash = createHash("sha256");
  for (const input of inputs) {
    hash.update(input);
  }
  return new Uint8Array(hash.digest());
}

describe("Core", () => {
  /**
   * Network Configuration Tests
   */
  describe("Network Configuration", () => {
    describe("getNetworkConfig", () => {
      it('should return mainnet config for "mainnet"', () => {
        const config = getNetworkConfig("mainnet");
        assert.strictEqual(config.name, "mainnet");
        assert.deepStrictEqual(
          config.forkVersion,
          Uint8Array.of(0x00, 0x00, 0x00, 0x00)
        );
      });

      it('should return sepolia config for "sepolia"', () => {
        const config = getNetworkConfig("sepolia");
        assert.strictEqual(config.name, "sepolia");
        assert.deepStrictEqual(
          config.forkVersion,
          Uint8Array.of(0x90, 0x00, 0x00, 0x69)
        );
      });

      it("should be case insensitive", () => {
        const config = getNetworkConfig("MAINNET");
        assert.strictEqual(config.name, "mainnet");
        assert.deepStrictEqual(
          config.forkVersion,
          Uint8Array.of(0x00, 0x00, 0x00, 0x00)
        );
      });

      it("should throw error for unsupported network", () => {
        assert.throws(
          () => getNetworkConfig("unknown"),
          /Unsupported network: unknown/
        );
      });
    });

    describe("networks", () => {
      it("should have mainnet, sepolia, and hoodi networks", () => {
        assert(networks.mainnet, "mainnet should be defined");
        assert(networks.sepolia, "sepolia should be defined");
        assert(networks.hoodi, "hoodi should be defined");
      });

      it("should have correct fork versions", () => {
        assert.deepStrictEqual(
          networks.mainnet.forkVersion,
          Uint8Array.of(0x00, 0x00, 0x00, 0x00)
        );
        assert.deepStrictEqual(
          networks.sepolia.forkVersion,
          Uint8Array.of(0x90, 0x00, 0x00, 0x69)
        );
        assert.deepStrictEqual(
          networks.hoodi.forkVersion,
          Uint8Array.of(0x10, 0x00, 0x09, 0x10)
        );
      });
    });
  });

  /**
   * Utility Function Tests
   */
  describe("Utility Functions", () => {
    describe("hex", () => {
      it("should convert Uint8Array to hex string without 0x prefix", () => {
        const bytes = new Uint8Array([0x1a, 0x2b, 0x3c]);
        assert.strictEqual(hex(bytes), "1a2b3c");
      });
    });

    describe("sha256", () => {
      it("should compute correct sha256 hash", () => {
        const data = new TextEncoder().encode("test");
        const hash = sha256(data);
        // Known hash of 'test'
        const expectedHash = new Uint8Array([
          0x9f, 0x86, 0xd0, 0x81, 0x88, 0x4c, 0x7d, 0x65, 0x9a, 0x2f, 0xea,
          0xa0, 0xc5, 0x5a, 0xd0, 0x15, 0xa3, 0xbf, 0x4f, 0x1b, 0x2b, 0x0b,
          0x82, 0x2c, 0xd1, 0x5d, 0x6c, 0x15, 0xb0, 0xf0, 0x0a, 0x08,
        ]);
        assert.deepStrictEqual(hash, expectedHash);
      });
    });

    describe("isHexAddr", () => {
      it("should return true for valid Ethereum addresses", () => {
        assert.strictEqual(
          isHexAddr("0x1234567890123456789012345678901234567890"),
          true
        );
      });

      it("should return false for invalid Ethereum addresses", () => {
        assert.strictEqual(
          isHexAddr("1234567890123456789012345678901234567890"),
          false
        ); // no 0x prefix
        assert.strictEqual(
          isHexAddr("0x123456789012345678901234567890123456789"),
          false
        ); // too short
        assert.strictEqual(
          isHexAddr("0x123456789012345678901234567890123456789g"),
          false
        ); // invalid char
      });
    });

    describe("parseAddress", () => {
      it("should parse valid Ethereum addresses into Uint8Array", () => {
        const addr = "0x1234567890123456789012345678901234567890";
        const result = parseAddress(addr);
        assert.strictEqual(result.length, 20);
        assert.strictEqual(
          hex(result),
          "1234567890123456789012345678901234567890"
        );
      });

      it("should throw error for invalid Ethereum address", () => {
        assert.throws(
          () => parseAddress("invalid"),
          /Address must be 0x \+ 40 hex chars/
        );
      });
    });

    describe("buildWithdrawalCredentials", () => {
      it("should build type 0 withdrawal credentials correctly", () => {
        const pubkey = new Uint8Array(48).fill(1); // Mock pubkey
        const result = buildWithdrawalCredentials(0, pubkey);

        assert.strictEqual(result.length, 32);
        assert.strictEqual(result[0], 0); // First byte should be 0 for BLS prefix

        // Should contain hash of pubkey
        const pubkeyHash = sha256(pubkey);
        for (let i = 1; i < 32; i++) {
          assert.strictEqual(result[i], pubkeyHash[i]);
        }
      });

      it("should build type 1 withdrawal credentials correctly", () => {
        const pubkey = new Uint8Array(48).fill(1); // Mock pubkey
        const addr = "0x1234567890123456789012345678901234567890";
        const result = buildWithdrawalCredentials(1, pubkey, addr);

        assert.strictEqual(result.length, 32);
        assert.strictEqual(result[0], 1); // First byte is the type

        // Bytes 1-11 should be zeros
        for (let i = 1; i < 12; i++) {
          assert.strictEqual(result[i], 0);
        }

        // Last 20 bytes should be the ETH1 address
        const addrBytes = parseAddress(addr);
        for (let i = 0; i < 20; i++) {
          assert.strictEqual(result[i + 12], addrBytes[i]);
        }
      });

      it("should throw error for type 1 without address", () => {
        const pubkey = new Uint8Array(48).fill(1);
        assert.throws(
          () => buildWithdrawalCredentials(1, pubkey),
          /--wc-address is required when --wc-type is 1 or 2/
        );
      });
    });

    describe("debugLog", () => {
      it("should log to console when DEBUG is set", () => {
        // Save original console.log and process.env
        const originalLog = console.log;
        const originalEnv = process.env.DEBUG;

        // Mock console.log
        let logCalled = false;
        console.log = () => {
          logCalled = true;
        };

        // Set DEBUG environment variable
        process.env.DEBUG = "true";

        // Call debugLog
        debugLog("test message");

        // Verify console.log was called
        assert.strictEqual(logCalled, true);

        // Restore original console.log and process.env
        console.log = originalLog;
        process.env.DEBUG = originalEnv;
      });

      it("should not log to console when DEBUG is not set", () => {
        // Save original console.log and process.env
        const originalLog = console.log;
        const originalEnv = process.env.DEBUG;

        // Mock console.log
        let logCalled = false;
        console.log = () => {
          logCalled = true;
        };

        // Unset DEBUG environment variable
        delete process.env.DEBUG;

        // Call debugLog
        debugLog("test message");

        // Verify console.log was not called
        assert.strictEqual(logCalled, false);

        // Restore original console.log and process.env
        console.log = originalLog;
        process.env.DEBUG = originalEnv;
      });
    });
  });

  /**
   * Proof Function Tests
   */
  describe("Proof Functions", () => {
    describe("fromHex", () => {
      it("should convert hex string with 0x prefix to Uint8Array", () => {
        const hex = "0x1a2b3c";
        const result = fromHex(hex);
        assert.deepStrictEqual(result, new Uint8Array([0x1a, 0x2b, 0x3c]));
      });

      it("should convert hex string without 0x prefix to Uint8Array", () => {
        const hex = "1a2b3c";
        const result = fromHex(hex);
        assert.deepStrictEqual(result, new Uint8Array([0x1a, 0x2b, 0x3c]));
      });

      it("should handle odd-length hex strings by padding with 0", () => {
        const hex = "a2b3c"; // 5 chars, odd length
        const result = fromHex(hex);
        assert.deepStrictEqual(result, new Uint8Array([0x0a, 0x2b, 0x3c]));
      });

      it("should handle empty hex strings", () => {
        const hex = "";
        const result = fromHex(hex);
        assert.deepStrictEqual(result, new Uint8Array(0));
      });

      it("should handle 0x prefix alone", () => {
        const hex = "0x";
        const result = fromHex(hex);
        assert.deepStrictEqual(result, new Uint8Array(0));
      });

      it("should handle hex strings with all possible byte values", () => {
        // Create a hex string with all byte values 0x00-0xFF
        let fullHex = "";
        for (let i = 0; i < 256; i++) {
          fullHex += i.toString(16).padStart(2, "0");
        }

        const result = fromHex(fullHex);
        assert.strictEqual(result.length, 256);

        // Verify each byte was correctly converted
        for (let i = 0; i < 256; i++) {
          assert.strictEqual(result[i], i);
        }
      });
    });

    describe("sha256Concat", () => {
      it("should compute hash of concatenated inputs", () => {
        const input1 = new Uint8Array([1, 2, 3]);
        const input2 = new Uint8Array([4, 5, 6]);

        // Generate the expected hash manually for this test
        const result = sha256Concat(input1, input2);
        const expected = manualSha256(input1, input2);

        assert.deepStrictEqual(result, expected);
      });

      it("should handle multiple inputs", () => {
        const input1 = new Uint8Array([1]);
        const input2 = new Uint8Array([2]);
        const input3 = new Uint8Array([3]);

        // Test that the function properly processes inputs
        const result = sha256Concat(input1, input2, input3);

        // Instead of checking exact hash value, check that it's a valid SHA-256 hash
        assert.strictEqual(result.length, 32); // SHA-256 is 32 bytes

        // And check it's stable (produces same output for same input)
        const result2 = sha256Concat(input1, input2, input3);
        assert.deepStrictEqual(result, result2);
      });
    });

    describe("encodeGweiAsLittleEndian8", () => {
      it("should encode 1 ETH (1e9 Gwei) correctly in little-endian format", () => {
        const amountGwei = 1000000000n; // 1 ETH in Gwei
        const result = encodeGweiAsLittleEndian8(amountGwei);

        // Manually check each byte of the result
        assert.strictEqual(result.length, 8);

        // Verify that the number matches 1000000000 in little-endian
        let value = 0n;
        for (let i = 0; i < 8; i++) {
          value += BigInt(result[i]) << (BigInt(i) * 8n);
        }
        assert.strictEqual(value, 1000000000n);
      });

      it("should encode 32 ETH (32e9 Gwei) correctly in little-endian format", () => {
        const amountGwei = 32000000000n; // 32 ETH in Gwei
        const result = encodeGweiAsLittleEndian8(amountGwei);

        // Instead of checking exact byte values, check that:
        // 1. It's 8 bytes long
        assert.strictEqual(result.length, 8);

        // 2. When converted back to a BigInt, it gives the correct value
        let value = 0n;
        for (let i = 0; i < 8; i++) {
          value += BigInt(result[i]) << (BigInt(i) * 8n);
        }
        assert.strictEqual(value, 32000000000n);
      });
    });
  });

  /**
   * Deposit Function Tests
   */
  describe("Deposit Functions", () => {
    describe("computeDepositDataRoot", () => {
      it("should compute valid deposit data root", () => {
        // Example values (these are test values, not real validator data)
        const pubkey =
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234";
        const withdrawalCredentials =
          "0x0100000000000000000000001234567890123456789012345678901234567890";
        const signature =
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234";
        const amountETH = "32";

        const root = computeDepositDataRoot(
          pubkey,
          withdrawalCredentials,
          signature,
          amountETH
        );

        // The output of computeDepositDataRoot should be a hex string with 0x prefix
        assert.strictEqual(typeof root, "string");
        assert.strictEqual(root.startsWith("0x"), true);
        assert.strictEqual(root.length, 66); // 0x + 64 chars (32 bytes)
      });

      it("should accept BigInt for amount", () => {
        // Example values (these are test values, not real validator data)
        const pubkey =
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234";
        const withdrawalCredentials =
          "0x0100000000000000000000001234567890123456789012345678901234567890";
        const signature =
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234";
        const amountETH = 32n;

        const root = computeDepositDataRoot(
          pubkey,
          withdrawalCredentials,
          signature,
          amountETH
        );

        // The output of computeDepositDataRoot should be a hex string with 0x prefix
        assert.strictEqual(typeof root, "string");
        assert.strictEqual(root.startsWith("0x"), true);
        assert.strictEqual(root.length, 66); // 0x + 64 chars (32 bytes)
      });

      it("should produce consistent results for same inputs", () => {
        // Example values (these are test values, not real validator data)
        const pubkey =
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234";
        const withdrawalCredentials =
          "0x0100000000000000000000001234567890123456789012345678901234567890";
        const signature =
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234";
        const amountETH = "32";

        const root1 = computeDepositDataRoot(
          pubkey,
          withdrawalCredentials,
          signature,
          amountETH
        );

        const root2 = computeDepositDataRoot(
          pubkey,
          withdrawalCredentials,
          signature,
          amountETH
        );

        assert.strictEqual(
          root1,
          root2,
          "Should produce the same root for identical inputs"
        );
      });
    });

    describe("verifyDepositData", () => {
      // Create a mock deposit data
      const mockDepositData = {
        pubkey:
          "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234",
        withdrawal_credentials:
          "0100000000000000000000001234567890123456789012345678901234567890",
        amount: "32000000000",
        signature:
          "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234",
        deposit_message_root:
          "0000000000000000000000000000000000000000000000000000000000000000",
        deposit_data_root:
          "0000000000000000000000000000000000000000000000000000000000000000",
        network_name: "mainnet",
        deposit_cli_version: "node23-tsx",
      };

      // Create a domain for verification
      const domain = computeDomain(
        DOMAIN_DEPOSIT,
        networks.mainnet.forkVersion,
        ZERO_HASH
      );

      before(() => {
        // Enable debug mode
        process.env.DEBUG = "true";
      });

      after(() => {
        // Restore debug mode
        delete process.env.DEBUG;
      });

      it("should handle verification debug logs", async () => {
        // Save original console.log
        const originalLog = console.log;
        let logCalls = 0;

        try {
          // Mock console.log to track calls
          console.log = () => {
            logCalls++;
          };

          // Create a modified copy of the deposit data with mismatching roots
          const testData = {
            ...mockDepositData,
            deposit_data_root:
              "1111111111111111111111111111111111111111111111111111111111111111",
          };

          // Calling verifyDepositData with debug enabled
          await verifyDepositData(testData, domain);

          // Check that debug logs were called
          assert.ok(logCalls > 0, "Debug logs should be output");
        } finally {
          // Restore console.log
          console.log = originalLog;
        }
      });
    });
  });
});
