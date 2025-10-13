import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("AssetToken", function () {
  async function deployAssetTokenFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const AssetToken = await hre.ethers.getContractFactory("AssetToken");
    const assetToken = await AssetToken.deploy();

    return { assetToken, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { assetToken, owner } = await loadFixture(deployAssetTokenFixture);
      expect(await assetToken.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should allow the owner to mint a new token", async function () {
      const { assetToken, owner, otherAccount } = await loadFixture(deployAssetTokenFixture);

      await expect(assetToken.connect(owner).safeMint(otherAccount.address))
        .to.emit(assetToken, "Transfer")
        .withArgs(hre.ethers.ZeroAddress, otherAccount.address, 0);

      expect(await assetToken.ownerOf(0)).to.equal(otherAccount.address);
    });

    it("Should not allow other accounts to mint a new token", async function () {
        const { assetToken, otherAccount } = await loadFixture(deployAssetTokenFixture);

        await expect(
            assetToken.connect(otherAccount).safeMint(otherAccount.address)
        ).to.be.revertedWithCustomError(assetToken, "OwnableUnauthorizedAccount");
    });
  });
});
