import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EscrowModule = buildModule("EscrowModule", (m) => {
  const escrow = m.contract("Escrow");

  return { escrow };
});

const AssetTokenModule = buildModule("AssetTokenModule", (m) => {
  const assetToken = m.contract("AssetToken");

  return { assetToken };
});

const DeployModule = buildModule("DeployModule", (m) => {
  const { escrow } = m.useModule(EscrowModule);
  const { assetToken } = m.useModule(AssetTokenModule);

  return { escrow, assetToken };
});

export default DeployModule;
