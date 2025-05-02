#!/usr/bin/env -S tsx

/**
 * Ethereum 2.0 Deposit Tool - API
 *
 * This module exports functionality for generating validator keys,
 * creating withdrawal credentials, and generating deposit data for Ethereum 2.0.
 */

// Export public types
export type {
  WithdrawalCredentialsType,
  NetworkConfig,
  DepositData,
  ValidatorKeys,
} from "./types.js";

// Export core functions for API usage
export {
  // Constants
  ONE_ETH_GWEI,
  networks,

  // Network functions
  getNetworkConfig,

  // Key generation
  generateValidatorKeys,
  getValidatorInfo,

  // Deposit data functions
  buildWithdrawalCredentials,
  generateDepositData,
  verifyDepositData,
  computeDepositDataRoot,
  createDepositData,

  // Utility functions
  sha256,
  hex,
  fromHex,
} from "./core.js";
