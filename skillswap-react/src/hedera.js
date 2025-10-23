import { ethers } from "ethers";
import {
    ContractExecuteTransaction,
    ContractFunctionParameters
} from "@hashgraph/sdk";
import { Buffer } from "buffer";

// Polyfill Buffer for browser environment
if (typeof window !== 'undefined') {
    window.Buffer = Buffer;
}

// --- 1. LIVE CONTRACT ADDRESSES (Updated) ---
export const escrowContractAddress = "0x48FbE77CeFb35Ba37c07851c2fD61457224407D5";
export const assetTokenContractAddress = "0x5FE7C5de2e343E2C25ea6e035213534751FB57F8";

// --- 2. CONTRACT BLUEPRINTS (ABIs) ---
export const escrowContractABI = [{"inputs":[{"internalType":"address","name":"_assetTokenAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"}],"name":"AssetListed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"}],"name":"EscrowFunded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ListingCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"}],"name":"SaleCompleted","type":"event"},{"inputs":[],"name":"assetTokenAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"cancelListing","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"confirmDelivery","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"fundEscrow","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"priceInTinybars","type":"uint256"}],"name":"listAsset","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"listings","outputs":[{"internalType":"address","name":"seller","type":"address"},{"internalType":"address","name":"buyer","type":"address"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"enum Escrow.ListingState","name":"state","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"refundBuyer","outputs":[],"stateMutability":"nonpayable","type":"function"}];
export const assetTokenContractABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721IncorrectOwner","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721InsufficientApproval","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC721InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"operator","type":"address"}],"name":"ERC721InvalidOperator","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"ERC721InvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC721InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC721InvalidSender","type":"error"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ERC721NonexistentToken","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"approved","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"operator","type":"address"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"assetData","outputs":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint26"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getApproved","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"getAssetData","outputs":[{"components":[{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"internalType":"struct AssetToken.AssetData","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"ownerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"assetType","type":"string"},{"internalType":"string","name":"quality","type":"string"},{"internalType":"string","name":"location","type":"string"}],"name":"safeMint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"operator","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"transferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"associate","outputs":[],"stateMutability":"nonpayable","type":"function"}];

// --- 3. Utility: Validate EVM address (no ENS, no malformed) ---
export function isValidEvmAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// --- 4. Provider & Contract Factories ---
export const getProvider = () => {
    const hederaTestnet = {
        name: "Hedera Testnet",
        chainId: 296,
        ensAddress: null, // Hedera does not support ENS
    };
    return new ethers.JsonRpcProvider("https://testnet.hashio.io/api", hederaTestnet);
};

const provider = getProvider();

// --- 5. Contract Factories (for use with signers) ---
export const getAssetTokenContract = (signerOrProvider = provider) => {
    if (!isValidEvmAddress(assetTokenContractAddress)) {
        throw new Error("Invalid assetTokenContractAddress. Must be a valid EVM address.");
    }
    return new ethers.Contract(assetTokenContractAddress, assetTokenContractABI, signerOrProvider);
};

export const getEscrowContract = (signerOrProvider = provider) => {
    if (!isValidEvmAddress(escrowContractAddress)) {
        throw new Error("Invalid escrowContractAddress. Must be a valid EVM address.");
    }
    return new ethers.Contract(escrowContractAddress, escrowContractABI, signerOrProvider);
};

// --- 6. NEW: Hedera SDK Transaction Executor ---
export const executeContractFunction = async (
    client,
    contractId,
    functionName,
    functionParams,
    gasLimit,
    payableAmount // in HBAR
) => {
    const tx = new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(gasLimit)
        .setFunction(functionName, functionParams);

    if (payableAmount) {
        tx.setPayableAmount(payableAmount);
    }

    const signedTx = await tx.signWithSigner(client.signer);
    const response = await signedTx.executeWithSigner(client.signer);

    // It's good practice to get the receipt to confirm the transaction was successful
    const receipt = await response.getReceipt(client);

    return receipt;
};


// --- 7. Export base, unsigned contract instances (read-only) ---
export const assetTokenContract = getAssetTokenContract();
export const escrowContract = getEscrowContract();
