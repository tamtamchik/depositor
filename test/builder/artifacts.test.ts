import assert from "node:assert";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import type {
  BuilderDepositRequest,
  BuilderProfileId,
  ValidatorDepositData,
} from "../../src/index.ts";
import {
  BuilderDepositMessageType,
  BuilderDepositRequestType,
  buildBuilderCallArtifact,
  buildBuilderWithdrawalCredentials,
  builderProfiles,
  computeDomain,
  computeSigningRoot,
  DepositDataType,
  DOMAIN_BUILDER_DEPOSIT,
  DOMAIN_DEPOSIT,
  encodeBuilderDepositCalldata,
  encodeBuilderDepositRequestRecord,
  fromHex,
  generateBuilderDepositRequest,
  generateBuilderKeys,
  generateValidatorDepositData,
  getBuilderProfile,
  getNetworkConfig,
  hex,
  verifyBuilderDepositRequest,
  verifyValidatorDepositData,
  ZERO_HASH,
} from "../../src/index.ts";

interface FixtureProfile {
  pubkey: string;
  withdrawal_credentials: string;
  signature: string;
  deposit_message_root: string;
  domain: string;
  signing_root: string;
  calldata: string;
  request_record: string;
}

interface BuilderFixture {
  mnemonic: string;
  password: string;
  execution_address: string;
  amount_gwei: string;
  network: string;
  profiles: Record<BuilderProfileId, FixtureProfile>;
}

describe("builder artifacts", () => {
  let outputDir: string;
  let fixture: BuilderFixture;
  let signing: Uint8Array;
  let pubkey: Uint8Array;

  before(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "depositor-builder-"));
    fixture = JSON.parse(
      await readFile(
        new URL("../fixtures/builder/profiles.json", import.meta.url),
        "utf8"
      )
    );
    ({ signing, pubkey } = await generateBuilderKeys(
      fixture.mnemonic,
      fixture.password,
      outputDir
    ));
  });

  after(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  describe("profile registry", () => {
    it("keeps profiles explicit, immutable, and research-only", () => {
      assert.strictEqual(Object.keys(builderProfiles).length, 2);
      for (const profile of Object.values(builderProfiles)) {
        assert.strictEqual(profile.maturity, "research-only");
        assert.strictEqual(profile.networkAvailability.hoodi, "unavailable");
        assert.strictEqual(profile.minimumRequestFeeWei, 1n);
        assert(Object.isFrozen(profile));
        assert(Object.isFrozen(profile.sources));
        assert(profile.sources.every((source) => Object.isFrozen(source)));
      }
      assert.throws(
        () => getBuilderProfile("default"),
        /Unknown builder profile/
      );
    });
  });

  describe("key material", () => {
    it("writes an EIP-2335 builder keystore with an empty path", async () => {
      const files = await readdir(outputDir);
      const filename = files.find((file) =>
        file.startsWith("builder-keystore-")
      );
      assert(filename);
      const keystore = JSON.parse(
        await readFile(join(outputDir, filename), "utf8")
      );
      assert.strictEqual(keystore.version, 4);
      assert.strictEqual(keystore.path, "");
      assert.strictEqual(
        keystore.pubkey,
        fixture.profiles["gloas-v1.7.0-alpha.11"].pubkey
      );
    });

    it("never overwrites an existing builder keystore", async () => {
      const collisionDir = await mkdtemp(join(tmpdir(), "depositor-collision-"));
      const originalNow = Date.now;
      Date.now = () => 1_800_000_000_000;
      try {
        await generateBuilderKeys(
          fixture.mnemonic,
          fixture.password,
          collisionDir
        );
        await assert.rejects(
          generateBuilderKeys(
            fixture.mnemonic,
            fixture.password,
            collisionDir
          ),
          /EEXIST/
        );
        assert.strictEqual((await readdir(collisionDir)).length, 1);
      } finally {
        Date.now = originalNow;
        await rm(collisionDir, { recursive: true, force: true });
      }
    });
  });

  describe("pinned protocol vectors", () => {
    for (const profileId of Object.keys(
      builderProfiles
    ) as BuilderProfileId[]) {
      it(`matches ${profileId}`, async () => {
      const expected = fixture.profiles[profileId];
      const request = await generateBuilderDepositRequest(
        pubkey,
        signing,
        fixture.execution_address,
        BigInt(fixture.amount_gwei),
        fixture.network,
        profileId
      );

      assert.strictEqual(request.pubkey, expected.pubkey);
      assert.strictEqual(
        request.withdrawal_credentials,
        expected.withdrawal_credentials
      );
      assert.strictEqual(request.signature, expected.signature);
      assert.strictEqual(
        request.deposit_message_root,
        expected.deposit_message_root
      );
      const profile = getBuilderProfile(profileId);
      const network = getNetworkConfig(fixture.network);
      const domain = computeDomain(
        fromHex(profile.domainBuilderDeposit),
        network.forkVersion,
        ZERO_HASH
      );
      const signingRoot = computeSigningRoot(
        BuilderDepositMessageType.hashTreeRoot({
          pubkey,
          withdrawalCredentials: fromHex(request.withdrawal_credentials),
          amount: BigInt(request.amount),
        }),
        domain
      );
      assert.strictEqual(hex(domain), expected.domain);
      assert.strictEqual(hex(signingRoot), expected.signing_root);
      assert.strictEqual(
        hex(encodeBuilderDepositCalldata(request)),
        expected.calldata
      );
      assert.strictEqual(
        hex(encodeBuilderDepositRequestRecord(request)),
        expected.request_record
      );
      assert.strictEqual(
        await verifyBuilderDepositRequest(request, profileId),
        true
      );
      });
    }
  });

  describe("protocol encoding", () => {
    it("encodes calldata as 184 bytes with a big-endian amount", async () => {
    const request = await fixtureRequest("eip8282-review-2026-08-30");
    const calldata = encodeBuilderDepositCalldata(request);
    assert.strictEqual(calldata.length, 184);
    assert.strictEqual(hex(calldata.slice(0, 48)), request.pubkey);
    assert.strictEqual(
      hex(calldata.slice(48, 80)),
      request.withdrawal_credentials
    );
    assert.strictEqual(hex(calldata.slice(80, 88)), "000000003b9aca00");
    assert.strictEqual(hex(calldata.slice(88)), request.signature);
    });

    it("encodes request records with a little-endian amount", async () => {
    const request = await fixtureRequest("eip8282-review-2026-08-30");
    const record = encodeBuilderDepositRequestRecord(request);
    assert.strictEqual(hex(record.slice(80, 88)), "00ca9a3b00000000");

    const serialized = BuilderDepositRequestType.serialize({
      pubkey: fromHex(request.pubkey),
      withdrawalCredentials: fromHex(request.withdrawal_credentials),
      amount: BigInt(request.amount),
      signature: fromHex(request.signature),
    });
    assert.deepStrictEqual(record, serialized);
    });
  });

  describe("call artifact", () => {
    it("keeps dynamic request fees unresolved unless supplied", async () => {
    const request = await fixtureRequest("eip8282-review-2026-08-30");
    const unresolved = await buildBuilderCallArtifact(request);
    assert.strictEqual(unresolved.to.toLowerCase(),
      "0x0000bff46984e3725691fa540a8c7589300d8282");
    assert.strictEqual(unresolved.request_fee_wei, null);
    assert.strictEqual(unresolved.value_wei, null);
    assert.strictEqual(unresolved.supported_for_submission, false);

    const withFee = await buildBuilderCallArtifact(request, 7n);
    assert.strictEqual(withFee.request_fee_wei, "7");
    assert.strictEqual(withFee.value_wei, "1000000000000000007");

    await assert.rejects(
      buildBuilderCallArtifact(request, 0n),
      /Request fee must be at least 1 wei/
    );
    await assert.rejects(
      buildBuilderCallArtifact(request, 1n << 256n),
      /Request fee must fit an unsigned 256-bit wei value/
    );
    await assert.rejects(
      buildBuilderCallArtifact(request, (1n << 256n) - 1n),
      /Builder call value must fit an unsigned 256-bit wei value/
    );
    });
  });

  describe("local validation", () => {
    it("rejects noncanonical builder artifact text", async () => {
    const request = await fixtureRequest("eip8282-review-2026-08-30");
    const variants: BuilderDepositRequest[] = [
      { ...request, amount: "0x3b9aca00" },
      { ...request, amount: "+1000000000" },
      { ...request, amount: "01000000000" },
      { ...request, pubkey: `0x${request.pubkey}` },
      { ...request, pubkey: request.pubkey.toUpperCase() },
      { ...request, network_name: "HOODI" },
      {
        ...request,
        deposit_contract_address: request.deposit_contract_address.toLowerCase(),
      },
    ];

    for (const variant of variants) {
      assert.strictEqual(await verifyBuilderDepositRequest(variant), false);
    }

    const mixedCaseAddress =
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const mixedCaseRequest = await generateBuilderDepositRequest(
      pubkey,
      signing,
      mixedCaseAddress,
      BigInt(fixture.amount_gwei),
      fixture.network,
      "eip8282-review-2026-08-30"
    );
    assert.strictEqual(
      await verifyBuilderDepositRequest({
        ...mixedCaseRequest,
        execution_address: `0x${mixedCaseAddress.slice(2).toUpperCase()}`,
      }),
      false
    );
    });

  it("rejects every mismatched builder request invariant", async () => {
    const request = await fixtureRequest("eip8282-review-2026-08-30");
    const variants: BuilderDepositRequest[] = [
      { ...request, builder_version: request.builder_version + 1 },
      { ...request, withdrawal_credential_version: "0x01" },
      { ...request, deposit_request_type: "0x04" },
      { ...request, amount_unit: "wei" } as unknown as BuilderDepositRequest,
      {
        ...request,
        key_derivation: "eip2334",
      } as unknown as BuilderDepositRequest,
      {
        ...request,
        withdrawal_credentials: `ff${request.withdrawal_credentials.slice(2)}`,
      },
      { ...request, fork_version: "00000000" },
      { ...request, deposit_message_root: "00".repeat(32) },
    ];

    for (const variant of variants) {
      assert.strictEqual(await verifyBuilderDepositRequest(variant), false);
    }
  });

  it("rejects a builder public key that does not match the secret key", async () => {
    const differentSigning = signing.slice();
    differentSigning[differentSigning.length - 1] ^= 1;
    await assert.rejects(
      generateBuilderDepositRequest(
        pubkey,
        differentSigning,
        fixture.execution_address,
        BigInt(fixture.amount_gwei),
        fixture.network,
        "eip8282-review-2026-08-30"
      ),
      /public key does not match the secret key/
    );
  });

  it("rejects malformed or unsafe builder requests locally", async () => {
    const request = await fixtureRequest("eip8282-review-2026-08-30");
    const badSignature = {
      ...request,
      signature: `00${request.signature.slice(2)}`,
    };
    assert.strictEqual(
      await verifyBuilderDepositRequest(badSignature),
      false
    );
    assert.strictEqual(
      await verifyBuilderDepositRequest(
        request,
        "gloas-v1.7.0-alpha.11"
      ),
      false
    );
    assert.strictEqual(
      await verifyBuilderDepositRequest({
        ...request,
        pubkey: request.pubkey.slice(2),
      }),
      false
    );
    assert.strictEqual(
      await verifyBuilderDepositRequest({
        ...request,
        profile_sources: [],
      }),
      false
    );
    assert.strictEqual(
      await verifyBuilderDepositRequest({
        ...request,
        domain_type: "03000000",
      }),
      false
    );
    await assert.rejects(
      buildBuilderCallArtifact(badSignature),
      /profile eip8282-review-2026-08-30: BLS proof of possession is invalid/
    );
    await assert.rejects(
      buildBuilderCallArtifact({
        ...request,
        domain_type: "03000000",
      }),
      /profile eip8282-review-2026-08-30: domain_type/
    );
    await assert.rejects(
      buildBuilderCallArtifact({
        ...request,
        pubkey: request.pubkey.slice(2),
      }),
      /profile eip8282-review-2026-08-30: Builder public key must be exactly 48 bytes/
    );
    await assert.rejects(
      generateBuilderDepositRequest(
        pubkey,
        signing,
        "0xnot-an-address",
        1_000_000_000n,
        fixture.network,
        "eip8282-review-2026-08-30"
      ),
      /Address must be/
    );
    await assert.rejects(
      generateBuilderDepositRequest(
        pubkey,
        signing,
        fixture.execution_address,
        999_999_999n,
        fixture.network,
        "eip8282-review-2026-08-30"
      ),
      /at least 1000000000 Gwei/
    );
    await assert.rejects(
      generateBuilderDepositRequest(
        pubkey,
        signing,
        fixture.execution_address,
        1n << 64n,
        fixture.network,
        "eip8282-review-2026-08-30"
      ),
      /unsigned 64-bit/
    );
    await assert.rejects(
      generateBuilderDepositRequest(
        pubkey,
        signing.slice(1),
        fixture.execution_address,
        1_000_000_000n,
        fixture.network,
        "eip8282-review-2026-08-30"
      ),
      /Builder secret key must be exactly 32 bytes/
    );
    await assert.rejects(
      generateBuilderDepositRequest(
        pubkey.slice(1),
        signing,
        fixture.execution_address,
        1_000_000_000n,
        fixture.network,
        "eip8282-review-2026-08-30"
      ),
      /Builder public key must be exactly 48 bytes/
    );
  });

  });

  describe("domain separation", () => {
    it("rejects validator proofs in builder deposits and builder proofs in validator deposits", async () => {
    const profileId = "eip8282-review-2026-08-30";
    const builderRequest = await fixtureRequest(profileId);
    const withdrawalCredentials = fromHex(
      builderRequest.withdrawal_credentials
    );
    const amount = Number(builderRequest.amount);

    const validatorSigned = await generateValidatorDepositData(
      pubkey,
      signing,
      withdrawalCredentials,
      amount,
      fixture.network
    );
    const validatorAsBuilder: BuilderDepositRequest = {
      ...builderRequest,
      signature: validatorSigned.signature,
      deposit_message_root: validatorSigned.deposit_message_root,
    };
    assert.strictEqual(
      await verifyBuilderDepositRequest(validatorAsBuilder),
      false
    );

    const builderSignature = fromHex(builderRequest.signature);
    const builderAsValidator: ValidatorDepositData = {
      pubkey: builderRequest.pubkey,
      withdrawal_credentials: builderRequest.withdrawal_credentials,
      amount,
      signature: builderRequest.signature,
      deposit_message_root: builderRequest.deposit_message_root,
      deposit_data_root: hex(
        DepositDataType.hashTreeRoot({
          pubkey,
          withdrawalCredentials,
          amount,
          signature: builderSignature,
        })
      ),
      network_name: fixture.network,
      deposit_cli_version: "2.0.0-test",
      fork_version: builderRequest.fork_version,
    };
    const network = getNetworkConfig(fixture.network);
    const validatorDomain = computeDomain(
      DOMAIN_DEPOSIT,
      network.forkVersion,
      ZERO_HASH
    );
    const builderDomain = computeDomain(
      DOMAIN_BUILDER_DEPOSIT,
      network.forkVersion,
      ZERO_HASH
    );
    assert.notDeepStrictEqual(validatorDomain, builderDomain);
    assert.strictEqual(
      await verifyValidatorDepositData(builderAsValidator, validatorDomain),
      false
    );
    });
  });

  describe("withdrawal credentials", () => {
    it("uses each profile-specific credential prefix", () => {
      assert.strictEqual(
        buildBuilderWithdrawalCredentials(
          fixture.execution_address,
          "gloas-v1.7.0-alpha.11"
        )[0],
        0x03
      );
      assert.strictEqual(
        buildBuilderWithdrawalCredentials(
          fixture.execution_address,
          "eip8282-review-2026-08-30"
        )[0],
        0xb0
      );
    });
  });

  async function fixtureRequest(
    profileId: BuilderProfileId
  ): Promise<BuilderDepositRequest> {
    return generateBuilderDepositRequest(
      pubkey,
      signing,
      fixture.execution_address,
      BigInt(fixture.amount_gwei),
      fixture.network,
      profileId
    );
  }
});
