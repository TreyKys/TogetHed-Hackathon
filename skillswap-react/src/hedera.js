import { ethers } from "ethers";

// --- 1. LIVE CONTRACT ADDRESSES (0x... format) ---
export const escrowContractAddress = "0xEB94FF870ff27d2Ee186278bE202083B116D52b6";
export const assetTokenContractAddress = "0x6330F12Ec109CA3fb8B8104c9542bB005372c8A8";

// --- 2. CONTRACT ABIs ---
// ⚠️ ACTION REQUIRED: Paste your full, correct ABIs here.
export const escrowContractABI = [/* PASTE FULL ESCROW ABI JSON HERE */];
export const assetTokenContractABI = [/* PASTE FULL ASSET TOKEN ABI JSON HERE */];

// --- 3. Ethers.js Provider Setup ---
const hederaTestnetRpcUrl = "https://testnet.hashio.io/api";
const provider = new ethers.JsonRpcProvider(hederaTestnetRpcUrl);

// Export a function to get the provider
export const getProvider = () => {
  return provider;
};

// --- 4. Ready-to-use Contract Instances (Base Blueprints) ---
// These are exported WITHOUT a signer. The App.jsx will connect them
// to the user's signer when it's time to send a transaction.
export const escrowContract = new ethers.Contract(escrowContractAddress, escrowContractABI, provider);
export const assetTokenContract = new ethers.Contract(assetTokenContractAddress, assetTokenContractABI, provider);
