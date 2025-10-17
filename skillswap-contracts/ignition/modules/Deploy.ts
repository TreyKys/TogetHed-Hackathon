import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DeployModule = buildModule("DeployModule", (m) => {
  // First, deploy the AssetToken contract as it has no dependencies.
  const assetToken = m.contract("AssetToken");

  // Then, deploy the Escrow contract, passing the address of the just-deployed
  // AssetToken contract to its constructor.
  const escrow = m.contract("Escrow", [assetToken]);

  // Return both contract instances for the deployment result.
  return { assetToken, escrow };
});

export default DeployModule;