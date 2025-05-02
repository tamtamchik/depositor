export interface NetworkConfig {
  name: string;
  forkVersion: Uint8Array;
}

export const networks: Record<string, NetworkConfig> = {
  mainnet: {
    name: "mainnet",
    forkVersion: Uint8Array.of(0x00, 0x00, 0x00, 0x00),
  },
  sepolia: {
    name: "sepolia",
    forkVersion: Uint8Array.of(0x90, 0x00, 0x00, 0x69),
  },
  hoodi: {
    name: "hoodi",
    forkVersion: Uint8Array.of(0x10, 0x00, 0x09, 0x10),
  },
};

export function getNetworkConfig(chain: string): NetworkConfig {
  const config = networks[chain.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported network: ${chain}`);
  }
  return config;
}
