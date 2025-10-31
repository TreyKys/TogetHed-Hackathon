// src/hedera.js
import {
  Client,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  AccountId,
  PrivateKey,
  ContractId
} from "@hashgraph/sdk";

export const ESCROW_CONTRACT_ACCOUNT_ID = "0.0.7140680"; // update if changed
export const ESCROW_CONTRACT_ADDRESS = "0x708522128Ff587Cd89F27B7B9883904a96e69b41"; // for record only
export const ASSET_TOKEN_ID = "0.0.7134449";

// Factory to create a client for a given user
export function getClientForAccount(accountIdStr, privateKeyStr) {
  // The SDK needs the raw private key without the '0x' prefix for ECDSA.
  const rawPrivateKey = privateKeyStr.startsWith("0x") ? privateKeyStr.slice(2) : privateKeyStr;
  const privateKey = PrivateKey.fromStringECDSA(rawPrivateKey);
  const accountId = AccountId.fromString(accountIdStr);
  return Client.forTestnet().setOperator(accountId, privateKey);
}

// Re-export classes for convenience
export {
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  AccountId,
  PrivateKey,
  ContractId,
  Client,
  TokenAssociateTransaction,
  AccountAllowanceApproveTransaction,
  TokenId,
  NftId,
};