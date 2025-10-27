import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// The address of the existing, deployed AssetToken contract.
const ASSET_TOKEN_CONTRACT_ADDRESS = "0x4670300c408d7c040715ba5f980791EfD0909B7a";

const DeployModule = buildModule("DeployModule", (m) => {
  // We are not deploying a new AssetToken contract.
  // Instead, we get a contract instance at the existing address.
  const assetToken = m.contractAt("AssetToken", ASSET_TOKEN_CONTRACT_ADDRESS);

  // Deploy the Escrow contract, passing the address of the existing
  // AssetToken contract to its constructor.
  const escrow = m.contract("Escrow", [assetToken]);

  // Return the new escrow contract instance for the deployment result.
  // We do not need to return assetToken since we didn't deploy it.
  return { escrow };
});

export default DeployModule;
