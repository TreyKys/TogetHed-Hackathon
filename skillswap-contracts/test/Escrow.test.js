const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow Contract", function () {
  let AssetToken, assetToken, Escrow, escrow, owner, seller, buyer;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    // Deploy a mock AssetToken contract
    AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy();
    await assetToken.waitForDeployment();

    // Deploy the Escrow contract with the AssetToken address
    Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(assetToken.target);
    await escrow.waitForDeployment();

    // Mint a token for the seller
    await assetToken.safeMint(seller.address, "Test Type", "Test Quality", "Test Location");
    // Approve the escrow contract to manage the token
    await assetToken.connect(seller).approve(escrow.target, 0);
  });

  it("Should list an asset correctly", async function () {
    const price = BigInt(50 * 1e8); // 50 HBAR in tinybars

    await escrow.connect(seller).listAsset(0, price);

    const listing = await escrow.listings(0);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.price).to.equal(price);
    expect(listing.state).to.equal(0); // 0 corresponds to LISTED
  });
});
