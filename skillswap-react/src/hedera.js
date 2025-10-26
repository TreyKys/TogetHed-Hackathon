import { ethers } from "ethers";

// ABIs - Kept here for clarity, but not exported directly
const escrowContractABI = [{"inputs":[{"internalType":"address","name":"_assetTokenAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"}],"name":"AssetListed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"}],"name":"EscrowFunded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ListingCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"}],"name":"SaleCompleted","type":"event"},{"inputs":[],"name":"assetTokenAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"cancelListing","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"confirmDelivery","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"fundEscrow","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"priceInTinybars","type":"uint256"}],"name":"listAsset","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"listings","outputs":[{"internalType":"address","name":"seller","type":"address"},{"internalType":"address","name":"buyer","type":"address"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"enum Escrow.ListingState","name":"state","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"refundBuyer","outputs":[],"stateMutability":"nonpayable","type":"function"}];

// --- 1. Export Required IDs and Addresses ---
export const escrowContractAddress = "0xB201fbf193a82eb1f41EBBfD2138917EAa53507C";
export const escrowContractAccountId = "0.0.7103874";
export const assetTokenId = "0.0.7134449"; // The one true Token ID for the NFT collection

// --- 2. Export Provider ---
export const getProvider = () => {
    const hederaTestnet = {
        name: "Hedera Testnet",
        chainId: 296,
        ensAddress: null,
    };
    return new ethers.JsonRpcProvider("https://testnet.hashio.io/api", hederaTestnet);
};

// --- 3. Export a function to get a new Escrow Contract instance ---
// This will be called in App.jsx to create an instance with a signer.
export const getEscrowContract = (signer) => {
    return new ethers.Contract(escrowContractAddress, escrowContractABI, signer);
};
