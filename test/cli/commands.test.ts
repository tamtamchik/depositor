import assert from "node:assert";
import { access, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import packageMetadata from "../../package.json" with { type: "json" };
import { createCli, main } from "../../src/cli.ts";
import { verifyBuilderDepositRequest } from "../../src/index.ts";
import {
  captureConsole,
  captureStdout,
  EXECUTION_ADDRESS,
  MNEMONIC,
  PASSWORD,
} from "../support/harness.ts";

describe("CLI routing", () => {
  it("exposes validator and builder command help", () => {
    const cli = createCli();
    const help = cli.helpInformation();
    assert.match(help, /validator/);
    assert.match(help, /builder/);
    assert.doesNotMatch(help, /--wc-type/);

    const validator = cli.commands.find(
      (command) => command.name() === "validator"
    );
    const validatorGenerate = validator?.commands.find(
      (command) => command.name() === "generate"
    );
    assert(validatorGenerate);
    assert.match(validatorGenerate.helpInformation(), /--wc-type/);

    const builder = cli.commands.find((command) => command.name() === "builder");
    const generate = builder?.commands.find(
      (command) => command.name() === "generate"
    );
    assert(generate);
    assert.match(generate.helpInformation(), /--execution-address/);
    assert.match(generate.helpInformation(), /--profile/);
  });

  it("renders root help and profile status without a command", async () => {
    const rootHelp = await captureStdout(() => main([]));
    assert.match(rootHelp, /validator/);
    assert.match(rootHelp, /builder/);

    const help = await captureStdout(() => main(["help"]));
    assert.match(help, /eip8282-review-2026-08-30 \(research-only\)/);
  });

  it("rejects unknown, incomplete, and excess command arguments", async () => {
    await assert.rejects(main(["nonsense"]), /Unknown command: nonsense/);
    await assert.rejects(main(["--wc-type=0"]), /Unknown option '--wc-type'/);
    await assert.rejects(main(["validator"]), /Usage: depositor validator generate/);
    await assert.rejects(main(["builder"]), /Usage: depositor builder generate/);
    await assert.rejects(
      main(["validator", "generate", "extra"]),
      /Too many arguments for 'generate'/
    );
  });
});

describe("validator CLI command", () => {
  it("writes canonical artifacts without printing secrets", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "depositor-validator-cli-"));
    try {
      const output = await captureConsole(() =>
        main([
          "validator",
          "generate",
          `--mnemonic=${MNEMONIC}`,
          `--password=${PASSWORD}`,
          "--wc-type=0",
          "--amount=1",
          `--out=${outputDir}`,
        ])
      );
      const filename = (await readdir(outputDir)).find((file) =>
        file.startsWith("deposit_data-")
      );
      assert(filename);
      const [deposit] = JSON.parse(
        await readFile(join(outputDir, filename), "utf8")
      );
      assert.strictEqual(deposit.amount, 1_000_000_000);
      assert.strictEqual(deposit.deposit_cli_version, packageMetadata.version);

      const consoleOutput = [...output.logs, ...output.warnings].join("\n");
      assert.doesNotMatch(consoleOutput, new RegExp(MNEMONIC));
      assert.doesNotMatch(consoleOutput, /Signing SK/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("requires an explicit destination for generated recovery material", async () => {
    await assert.rejects(
      main(["validator", "generate", `--password=${PASSWORD}`, "--wc-type=0"]),
      /requires --mnemonic-out=<path> or --show-mnemonic/
    );
  });

  it("writes generated recovery material only to its explicit path", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "depositor-recovery-cli-"));
    const mnemonicFile = join(outputDir, "recovery.txt");
    try {
      const output = await captureConsole(() =>
        main([
          "validator",
          "generate",
          `--password=${PASSWORD}`,
          "--wc-type=0",
          "--amount=1",
          `--mnemonic-out=${mnemonicFile}`,
          `--out=${outputDir}`,
        ])
      );
      const mnemonic = (await readFile(mnemonicFile, "utf8")).trim();
      assert(mnemonic.split(" ").length >= 12);
      const consoleOutput = [...output.logs, ...output.warnings].join("\n");
      assert.doesNotMatch(consoleOutput, new RegExp(mnemonic));
      assert.doesNotMatch(consoleOutput, /Signing SK/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("restores DEBUG after a failed command", async () => {
    const originalDebug = process.env.DEBUG;
    delete process.env.DEBUG;
    try {
      await assert.rejects(
        main(["validator", "generate", "--debug"]),
        /--password is required/
      );
      assert.strictEqual(process.env.DEBUG, undefined);

      process.env.DEBUG = "existing";
      await assert.rejects(
        main(["validator", "generate", "--debug"]),
        /--password is required/
      );
      assert.strictEqual(process.env.DEBUG, "existing");
    } finally {
      if (originalDebug === undefined) delete process.env.DEBUG;
      else process.env.DEBUG = originalDebug;
    }
  });

  it("rejects invalid validator counts, amounts, and credential options", async () => {
    const common = [
      "validator",
      "generate",
      `--mnemonic=${MNEMONIC}`,
      `--password=${PASSWORD}`,
      "--wc-type=0",
    ];
    const cases: Array<[string[], RegExp]> = [
      [[...common, "--validators=abc"], /positive integer/],
      [[...common, "--validators=0"], /positive integer/],
      [[...common, "--amount=0.999999999"], /at least 1 ETH/],
      [[...common, "--amount=1.0000000001"], /at most 9 decimal places/],
      [
        [...common, "--amount=9007199.254740992"],
        /must not exceed 9007199\.254740991 ETH/,
      ],
      [
        [
          "validator",
          "generate",
          `--mnemonic=${MNEMONIC}`,
          `--password=${PASSWORD}`,
          "--wc-type=3",
        ],
        /--wc-type must be 0, 1, or 2/,
      ],
      [
        [
          "validator",
          "generate",
          `--mnemonic=${MNEMONIC}`,
          `--password=${PASSWORD}`,
          "--wc-type=1",
        ],
        /--wc-address is required/,
      ],
    ];

    for (const [args, expected] of cases) {
      await assert.rejects(main(args), expected);
    }
  });

  it("shows generated recovery material only after explicit acknowledgement", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "depositor-display-cli-"));
    try {
      const output = await captureConsole(() =>
        main([
          "validator",
          "generate",
          `--password=${PASSWORD}`,
          "--wc-type=0",
          "--show-mnemonic",
          `--out=${outputDir}`,
        ])
      );
      const match = output.logs.join("\n").match(/Mnemonic: ([a-z ]+)/);
      assert(match);
      assert(match[1].trim().split(" ").length >= 12);
      assert.doesNotMatch(output.logs.join("\n"), /Signing SK/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

describe("builder CLI command", () => {
  const profile = "--profile=eip8282-review-2026-08-30";

  it("writes verified offline request and call artifacts", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "depositor-builder-cli-"));
    try {
      const output = await captureConsole(() =>
        main([
          "builder",
          "generate",
          "--experimental",
          profile,
          `--mnemonic=${MNEMONIC}`,
          `--password=${PASSWORD}`,
          `--execution-address=${EXECUTION_ADDRESS}`,
          "--amount=1",
          "--request-fee-wei=7",
          "--allow-unsupported-network",
          `--out=${outputDir}`,
        ])
      );
      const files = await readdir(outputDir);
      assert(files.some((file) => file.startsWith("builder-keystore-")));
      const requestFile = files.find((file) =>
        file.startsWith("builder_deposit_request-")
      );
      const callFile = files.find((file) =>
        file.startsWith("builder_deposit_call-")
      );
      assert(requestFile);
      assert(callFile);

      const request = JSON.parse(await readFile(join(outputDir, requestFile), "utf8"));
      const call = JSON.parse(await readFile(join(outputDir, callFile), "utf8"));
      assert.deepStrictEqual(Object.keys(request), [
        "pubkey",
        "withdrawal_credentials",
        "amount",
        "signature",
      ]);
      assert.strictEqual(
        await verifyBuilderDepositRequest(
          request,
          "hoodi",
          "eip8282-review-2026-08-30"
        ),
        true
      );
      assert.strictEqual(call.calldata_length, 184);
      assert.strictEqual(call.calldata.length, 2 + 184 * 2);
      assert.strictEqual(call.value_wei, "1000000000000000007");
      assert.strictEqual(call.supported_for_submission, false);

      const consoleOutput = [...output.logs, ...output.warnings].join("\n");
      assert.doesNotMatch(consoleOutput, new RegExp(MNEMONIC));
      assert.doesNotMatch(consoleOutput, /Signing SK/);
      assert.match(consoleOutput, /Research-only artifact/);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("requires every experimental safety acknowledgement", async () => {
    const common = [
      "builder",
      "generate",
      `--mnemonic=${MNEMONIC}`,
      `--password=${PASSWORD}`,
      `--execution-address=${EXECUTION_ADDRESS}`,
    ];
    await assert.rejects(main(common), /requires --experimental/);
    await assert.rejects(
      main([...common, "--experimental"]),
      /requires --profile=<id>/
    );
    await assert.rejects(
      main([...common, "--experimental", profile]),
      /requires --allow-unsupported-network/
    );
    await assert.rejects(
      main([
        "builder",
        "generate",
        "--experimental",
        profile,
        "--allow-unsupported-network",
      ]),
      /--password is required/
    );
    await assert.rejects(
      main([
        "builder",
        "generate",
        "--experimental",
        profile,
        "--allow-unsupported-network",
        `--password=${PASSWORD}`,
      ]),
      /--execution-address is required/
    );
  });

  it("rejects unknown profiles, hybrid flags, and unsafe numeric input", async () => {
    const common = [
      "builder",
      "generate",
      "--experimental",
      `--mnemonic=${MNEMONIC}`,
      `--password=${PASSWORD}`,
      `--execution-address=${EXECUTION_ADDRESS}`,
      "--allow-unsupported-network",
    ];
    const cases: Array<[string[], RegExp]> = [
      [[...common, "--profile=unknown"], /Unknown builder profile/],
      [[...common, profile, "--domain=0x0e000000"], /Unknown option '--domain'/],
      [[...common, profile, "--wc-prefix=0xb0"], /Unknown option '--wc-prefix'/],
      [[...common, profile, "--amount=1.0000000001"], /at most 9 decimal places/],
      [[...common, profile, "--amount=1e3"], /at most 9 decimal places/],
      [
        [...common, profile, "--amount=18446744073.709551616"],
        /unsigned 64-bit Gwei value/,
      ],
      [
        [...common, profile, "--request-fee-wei=-1"],
        /request-fee-wei must be a non-negative integer/,
      ],
      [[...common, profile, "--request-fee-wei=0"], /at least 1 wei/],
    ];

    for (const [args, expected] of cases) {
      await assert.rejects(main(args), expected);
    }
  });

  it("requires a separate mainnet acknowledgement", async () => {
    await assert.rejects(
      main([
        "builder",
        "generate",
        "--experimental",
        profile,
        `--mnemonic=${MNEMONIC}`,
        `--password=${PASSWORD}`,
        `--execution-address=${EXECUTION_ADDRESS}`,
        "--chain=mainnet",
        "--allow-unsupported-network",
      ]),
      /--chain=mainnet requires --allow-mainnet/
    );
  });
});

describe("CLI write safety", () => {
  it("validates policy and addresses before writing recovery material", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "depositor-policy-cli-"));
    const cases: Array<{ args: string[]; path: string; error: RegExp }> = [
      {
        args: [
          "validator",
          "generate",
          `--password=${PASSWORD}`,
          "--wc-type=0",
          "--chain=mainnet",
        ],
        path: join(outputDir, "validator-mainnet.txt"),
        error: /--chain=mainnet requires --allow-mainnet/,
      },
      {
        args: [
          "validator",
          "generate",
          `--password=${PASSWORD}`,
          "--wc-type=1",
          "--wc-address=invalid",
        ],
        path: join(outputDir, "validator-address.txt"),
        error: /Address must be 0x \+ 40 hex chars/,
      },
      {
        args: [
          "builder",
          "generate",
          "--experimental",
          "--profile=eip8282-review-2026-08-30",
          `--password=${PASSWORD}`,
          `--execution-address=${EXECUTION_ADDRESS}`,
        ],
        path: join(outputDir, "builder-policy.txt"),
        error: /requires --allow-unsupported-network/,
      },
      {
        args: [
          "builder",
          "generate",
          "--experimental",
          "--profile=eip8282-review-2026-08-30",
          `--password=${PASSWORD}`,
          "--execution-address=invalid",
          "--allow-unsupported-network",
        ],
        path: join(outputDir, "builder-address.txt"),
        error: /Address must be 0x \+ 40 hex chars/,
      },
    ];

    try {
      for (const testCase of cases) {
        await assert.rejects(
          main([
            ...testCase.args,
            `--mnemonic-out=${testCase.path}`,
            `--out=${outputDir}`,
          ]),
          testCase.error
        );
        await assert.rejects(access(testCase.path));
      }
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
