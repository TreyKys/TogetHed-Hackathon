import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { AccountId } from "@hashgraph/sdk";

const DeployModule = buildModule("DeployModule", (m) => {
  // This is the pre-existing, valid HTS token that the backend mints.
  const assetTokenId = "0.0.7134449";
  const assetTokenAddress = "0x" + AccountId.fromString(assetTokenId).toSolidityAddress();

  // Deploy the Escrow contract, passing the address of the HTS token
  // to its constructor. This allows the Escrow contract to correctly
  // query the ownership of the HTS NFTs.
  const escrow = m.contract("Escrow", [assetTokenAddress]);
  const lendingPool = m.contract("LendingPool", [assetTokenAddress]);

  return { escrow, lendingPool };
});

export default DeployModule;
