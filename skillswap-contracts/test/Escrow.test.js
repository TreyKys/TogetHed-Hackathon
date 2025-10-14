const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Escrow Contract", function () {
  let Escrow, escrow, owner, seller, buyer;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();
    await escrow.waitForDeployment();
  });

  it("Should create a new gig correctly", async function () {
    const gigPrice = ethers.parseEther("10"); // 10 HBAR

    // The 'buyer' creates the gig for the 'seller'
    await escrow.connect(buyer).createGig(seller.address, gigPrice);

    // Check if the gig was created with the correct details
    const gig = await escrow.gigs(0); // Get the first gig (ID 0)

    expect(gig.seller).to.equal(seller.address);
    expect(gig.buyer).to.equal(buyer.address);
    expect(gig.price).to.equal(gigPrice);
    expect(gig.state).to.equal(0); // 0 corresponds to State.AWAITING_PAYMENT
  });
});
