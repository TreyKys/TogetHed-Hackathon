import { getProvider, escrowContractAddress, assetTokenContractAddress, getEscrowContract } from "../src/hedera.js";

(async () => {
  try {
    const provider = getProvider();
    console.log("Network:", await provider.getNetwork());
    console.log("Code at assetTokenContractAddress:", await provider.getCode(assetTokenContractAddress));
    console.log("Code at escrowContractAddress:", await provider.getCode(escrowContractAddress));
    const escrow = getEscrowContract(provider);
    console.log("listAsset fragments:", escrow.interface.fragments.filter(f => f.name === "listAsset"));

    // New code to check the stored assetTokenAddress
    const configuredAssetTokenAddress = await escrow.assetTokenAddress();
    console.log("Escrow contract's configured assetTokenAddress:", configuredAssetTokenAddress);
    console.log("Expected assetTokenContractAddress from hedera.js:", assetTokenContractAddress);

    if (configuredAssetTokenAddress.toLowerCase() !== assetTokenContractAddress.toLowerCase()) {
      console.error("\nCRITICAL MISMATCH: The Escrow contract is pointing to a different AssetToken contract.");
    } else {
      console.log("\n✅ SUCCESS: The Escrow contract is correctly configured with the expected AssetToken contract address.");
    }

  } catch (e) {
    console.error("An error occurred during the diagnostic check:", e.message);
  }
})();
