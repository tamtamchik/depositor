import { encodeHex } from "../hex.ts";
import { WEI_PER_GWEI } from "../units.ts";
import { encodeBuilderDepositCalldata } from "./encoding.ts";
import { assertBuilderDepositRequest } from "./request.ts";
import type {
  BuilderCallArtifact,
  BuilderDepositRequest,
  BuilderNetworkAvailability,
  BuilderProfile,
} from "./types.ts";
import {
  calculateBuilderCallValue,
  requestFields,
} from "./validation.ts";

function networkAvailability(
  profile: BuilderProfile,
  chain: string
): BuilderNetworkAvailability {
  return profile.networkAvailability[chain] ?? "unavailable";
}

/**
 * Creates an offline execution-call artifact from a verified builder request.
 *
 * The function verifies the full request before it encodes calldata.
 * The function does not create, sign, or submit an execution transaction.
 * `value_wei` is null when `requestFeeWei` is not supplied.
 *
 * @param request This object contains a signed builder deposit request.
 * @param requestFeeWei This value gives the current dynamic request fee in wei.
 * @returns The function returns the target, calldata, value, and deployment metadata.
 * @throws The function throws if the request, fee, profile, or calldata is invalid.
 */
export async function buildBuilderCallArtifact(
  request: BuilderDepositRequest,
  requestFeeWei?: bigint
): Promise<BuilderCallArtifact> {
  await assertBuilderDepositRequest(request);

  const fields = requestFields(request);
  const profile = fields.profile;
  const calldata = encodeBuilderDepositCalldata(request);
  const amountGwei = fields.amount;
  const amountWei = amountGwei * WEI_PER_GWEI;
  const fee = requestFeeWei ?? null;
  const valueWei =
    fee === null ? null : calculateBuilderCallValue(amountWei, fee, profile);
  const availability = networkAvailability(profile, request.network_name);

  return {
    spec_profile: profile.id,
    profile_maturity: profile.maturity,
    network_name: request.network_name,
    network_availability: availability,
    supported_for_submission:
      availability === "active" || availability === "testnet",
    to: profile.depositContractAddress,
    calldata: `0x${encodeHex(calldata)}`,
    calldata_length: calldata.length,
    amount_gwei: amountGwei.toString(),
    amount_wei: amountWei.toString(),
    dynamic_fee_required: true,
    request_fee_wei: fee?.toString() ?? null,
    value_wei: valueWei?.toString() ?? null,
  };
}
