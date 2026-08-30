import assert from "node:assert";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  computeDomain,
  computeSigningRoot,
  debugLog,
  encodeGweiAsBigEndian8,
  encodeGweiAsLittleEndian8,
  fromHex,
  getNetworkConfig,
  hex,
  isHexAddr,
  networks,
  parseAddress,
  sha256,
  sha256Concat,
  ZERO_HASH,
} from "../src/index.ts";

describe("consensus primitives", () => {
  it("resolves supported networks and normalizes network names", () => {
    const expected = {
      mainnet: "00000000",
      sepolia: "90000069",
      hoodi: "10000910",
    };

    for (const [name, forkVersion] of Object.entries(expected)) {
      assert.strictEqual(hex(getNetworkConfig(name).forkVersion), forkVersion);
      assert.strictEqual(hex(networks[name].forkVersion), forkVersion);
    }
    assert.strictEqual(getNetworkConfig("HoOdI").name, "hoodi");
  });

  it("returns an isolated fork-version copy", () => {
    const config = getNetworkConfig("hoodi");
    config.forkVersion[0] = 0xff;
    assert.strictEqual(hex(getNetworkConfig("hoodi").forkVersion), "10000910");

    const original = networks.hoodi.forkVersion[0];
    networks.hoodi.forkVersion[0] = 0xff;
    try {
      assert.strictEqual(getNetworkConfig("hoodi").forkVersion[0], 0x10);
    } finally {
      networks.hoodi.forkVersion[0] = original;
    }
  });

  it("rejects unsupported networks", () => {
    assert.throws(() => getNetworkConfig("unknown"), /Unsupported network/);
  });

  it("rejects invalid consensus field lengths", () => {
    assert.throws(
      () => computeDomain(new Uint8Array(3), new Uint8Array(4), ZERO_HASH),
      /Domain type must be exactly 4 bytes/
    );
    assert.throws(
      () => computeDomain(new Uint8Array(4), new Uint8Array(3), ZERO_HASH),
      /Fork version must be exactly 4 bytes/
    );
    assert.throws(
      () => computeDomain(new Uint8Array(4), new Uint8Array(4), new Uint8Array(31)),
      /Genesis validators root must be exactly 32 bytes/
    );
    assert.throws(
      () => computeSigningRoot(new Uint8Array(31), new Uint8Array(32)),
      /Object root must be exactly 32 bytes/
    );
    assert.throws(
      () => computeSigningRoot(new Uint8Array(32), new Uint8Array(31)),
      /Domain must be exactly 32 bytes/
    );
  });
});

describe("hex and address primitives", () => {
  it("encodes and decodes hexadecimal bytes", () => {
    const cases = [
      ["0x1a2b3c", Uint8Array.of(0x1a, 0x2b, 0x3c)],
      ["1a2b3c", Uint8Array.of(0x1a, 0x2b, 0x3c)],
      ["a2b3c", Uint8Array.of(0x0a, 0x2b, 0x3c)],
      ["", new Uint8Array()],
      ["0x", new Uint8Array()],
    ] as const;

    for (const [value, expected] of cases) {
      assert.deepStrictEqual(fromHex(value), expected);
    }
    assert.strictEqual(hex(Uint8Array.of(0x1a, 0x2b, 0x3c)), "1a2b3c");
  });

  it("round-trips every byte value", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    assert.deepStrictEqual(fromHex(hex(bytes)), bytes);
  });

  it("rejects non-hexadecimal text", () => {
    assert.throws(() => fromHex("0xzz"), /only hex characters/);
  });

  it("validates and parses 20-byte execution addresses", () => {
    const address = "0x1234567890123456789012345678901234567890";
    assert.strictEqual(isHexAddr(address), true);
    assert.strictEqual(hex(parseAddress(address)), address.slice(2));

    for (const invalid of [
      address.slice(2),
      address.slice(0, -1),
      `${address.slice(0, -1)}g`,
    ]) {
      assert.strictEqual(isHexAddr(invalid), false);
    }
    assert.throws(() => parseAddress("invalid"), /Address must be 0x \+ 40 hex chars/);
  });
});

describe("hash primitives", () => {
  it("computes the SHA-256 test vector", () => {
    assert.strictEqual(
      hex(sha256(new TextEncoder().encode("test"))),
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    );
  });

  it("hashes concatenated inputs in order", () => {
    const inputs = [Uint8Array.of(1, 2, 3), Uint8Array.of(4, 5, 6)];
    const expected = createHash("sha256")
      .update(inputs[0])
      .update(inputs[1])
      .digest();
    assert.deepStrictEqual(sha256Concat(...inputs), new Uint8Array(expected));
  });
});

describe("Gwei encoding", () => {
  it("encodes uint64 Gwei in both protocol byte orders", () => {
    assert.strictEqual(
      hex(encodeGweiAsLittleEndian8(1_000_000_000n)),
      "00ca9a3b00000000"
    );
    assert.strictEqual(
      hex(encodeGweiAsBigEndian8(1_000_000_000n)),
      "000000003b9aca00"
    );
  });

  it("accepts uint64 boundaries and rejects out-of-range values", () => {
    for (const encode of [encodeGweiAsLittleEndian8, encodeGweiAsBigEndian8]) {
      assert.strictEqual(encode(0n).length, 8);
      assert.strictEqual(encode((1n << 64n) - 1n).length, 8);
      assert.throws(() => encode(-1n), /unsigned 64-bit Gwei/);
      assert.throws(() => encode(1n << 64n), /unsigned 64-bit Gwei/);
    }
  });
});

describe("debug output", () => {
  it("writes only while DEBUG is enabled", () => {
    const originalDebug = process.env.DEBUG;
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    try {
      delete process.env.DEBUG;
      debugLog("hidden");
      process.env.DEBUG = "true";
      debugLog("visible");
      assert.deepStrictEqual(logs, ["visible"]);
    } finally {
      console.log = originalLog;
      if (originalDebug === undefined) delete process.env.DEBUG;
      else process.env.DEBUG = originalDebug;
    }
  });
});
