import { ethers } from "ethers";

// --- 1. LIVE HEDERA AND CONTRACT IDENTIFIERS ---
export const assetTokenId = "0.0.6961423"; // The 0.0.X ID of the NFT Collection
export const escrowContractAddress = "0x539951a236A8135ecdA8aB554153DEAF5EDF3b23"; // EVM 0x address
export const escrowContractAccountId = "0.0.6961427"; // The 0.0.X ID of the Escrow Contract

// --- 2. ESCROW CONTRACT ABI ---
// (This is still needed for ethers.js to interact with the contract)
const escrowContractABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"assetToken","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"}],"name":"AssetListed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"assetToken","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"}],"name":"EscrowFunded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"assetToken","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ListingCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"assetToken","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"}],"name":"SaleCompleted","type":"event"},{"inputs":[{"internalType":"address","name":"assetTokenAddress","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"cancelListing","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"assetTokenAddress","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"confirmDelivery","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"assetTokenAddress","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"fundEscrow","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"assetTokenAddress","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getListingKey","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"assetTokenAddress","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"priceInTinybars","type":"uint256"}],"name":"listAsset","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"listings","outputs":[{"internalType":"address","name":"seller","type":"address"},{"internalType":"address","name":"buyer","type":"address"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"enum Escrow.ListingState","name":"state","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"assetTokenAddress","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"refundBuyer","outputs":[],"stateMutability":"nonpayable","type":"function"}];

// --- 3. HEDERA JSON-RPC PROVIDER ---
export const getProvider = () => {
    const hederaTestnet = {
        name: "Hedera Testnet",
        chainId: 296,
        ensAddress: null, // Hedera does not support ENS
    };
    return new ethers.JsonRpcProvider("https://testnet.hashio.io/api", hederaTestnet);
};

// --- 4. BASE (UNSIGNED) ESCROW CONTRACT INSTANCE ---
// This is used for read-only operations or for connecting a signer later.
const provider = getProvider();
export const escrowContract = new ethers.Contract(escrowContractAddress, escrowContractABI, provider);

// --- 5. FUNCTION TO GET A SIGNED ESCROW CONTRACT INSTANCE ---
// This is a helper function to be used in App.jsx when a signer is available.
export const getEscrowContractWithSigner = (signer) => {
    return new ethers.Contract(escrowContractAddress, escrowContractABI, signer);
};
