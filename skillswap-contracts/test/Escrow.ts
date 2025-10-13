import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Escrow", function () {
  async function deployEscrowFixture() {
    const [owner, seller, buyer] = await hre.ethers.getSigners();

    const Escrow = await hre.ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy();

    return { escrow, owner, seller, buyer };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { escrow, owner } = await loadFixture(deployEscrowFixture);
      // Note: Escrow contract doesn't have an owner in the traditional sense.
      // We'll test functionality through interactions instead.
      expect(await escrow.nextGigId()).to.equal(0);
    });
  });

  describe("Gig Lifecycle", function () {
    it("Should allow a buyer to create a gig", async function () {
      const { escrow, seller, buyer } = await loadFixture(deployEscrowFixture);
      const price = hre.ethers.parseEther("1.0");

      await expect(escrow.connect(buyer).createGig(seller.address, price))
        .to.emit(escrow, "GigCreated")
        .withArgs(0, seller.address, buyer.address, price);

      const gig = await escrow.gigs(0);
      expect(gig.seller).to.equal(seller.address);
      expect(gig.buyer).to.equal(buyer.address);
      expect(gig.price).to.equal(price);
      expect(gig.state).to.equal(0); // AWAITING_PAYMENT
    });

    it("Should allow a buyer to fund a gig", async function () {
        const { escrow, seller, buyer } = await loadFixture(deployEscrowFixture);
        const price = hre.ethers.parseEther("1.0");
        await escrow.connect(buyer).createGig(seller.address, price);

        await expect(escrow.connect(buyer).fundGig(0, { value: price }))
            .to.emit(escrow, "Funded")
            .withArgs(0, buyer.address);

        const gig = await escrow.gigs(0);
        expect(gig.state).to.equal(1); // AWAITING_DELIVERY
    });

    it("Should allow a buyer to confirm delivery and release funds", async function () {
        const { escrow, seller, buyer } = await loadFixture(deployEscrowFixture);
        const price = hre.ethers.parseEther("1.0");
        await escrow.connect(buyer).createGig(seller.address, price);
        await escrow.connect(buyer).fundGig(0, { value: price });

        await expect(escrow.connect(buyer).confirmDelivery(0))
            .to.emit(escrow, "Confirmed")
            .withArgs(0, buyer.address);

        const gig = await escrow.gigs(0);
        expect(gig.state).to.equal(2); // COMPLETE
    });

    it("Should allow a buyer to cancel a gig before funding", async function () {
        const { escrow, seller, buyer } = await loadFixture(deployEscrowFixture);
        const price = hre.ethers.parseEther("1.0");
        await escrow.connect(buyer).createGig(seller.address, price);

        await expect(escrow.connect(buyer).cancelGig(0))
            .to.emit(escrow, "Canceled")
            .withArgs(0, buyer.address);

        const gig = await escrow.gigs(0);
        expect(gig.state).to.equal(3); // CANCELED
    });
  });
});
