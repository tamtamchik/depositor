import { createHash } from "node:crypto";
import { toHexString } from "@chainsafe/ssz";
import { WithdrawalCredentialsType } from "./types";

export const ONE_ETH_GWEI = 1_000_000_000; // 1 ETH = 1e9 Gwei

export const hex = (u: Uint8Array) => toHexString(u).slice(2); // strip 0x

export const sha256 = (d: Uint8Array) =>
  new Uint8Array(createHash("sha256").update(d).digest());

export const isHexAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

export const parseAddress = (addr: string): Uint8Array => {
  if (!isHexAddr(addr)) throw new Error("Address must be 0x + 40 hex chars");
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++)
    bytes[i] = parseInt(addr.slice(2 + i * 2, 4 + i * 2), 16);
  return bytes;
};

export function buildWithdrawalCredentials(
  type: WithdrawalCredentialsType,
  pub: Uint8Array,
  addr?: string
): Uint8Array {
  const out = new Uint8Array(32);
  if (type === 0) {
    out.set(sha256(pub).subarray(1), 1);
  } else {
    if (!addr)
      throw new Error("--address is required when --wc-type is 1 or 2");
    out[0] = type;
    out.set(parseAddress(addr), 12);
  }
  return out;
}
