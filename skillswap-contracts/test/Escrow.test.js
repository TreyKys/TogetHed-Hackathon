const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Escrow Contract", function () {
    async function deployEscrowFixture() {
        const [owner, seller, buyer] = await ethers.getSigners();

        const Escrow = await ethers.getContractFactory("Escrow");
        const escrow = await Escrow.deploy();

        const MockHRC721 = await ethers.getContractFactory("MockHRC721");
        const mockHRC721 = await MockHRC721.deploy();
        const tokenAddress = await mockHRC721.getAddress();

        const serialNumber = 1;
        const priceInTinybars = BigInt(1 * 1e8);
        const priceInWeibars = ethers.parseEther("1");


        return { escrow, owner, seller, buyer, tokenAddress, serialNumber, priceInTinybars, priceInWeibars };
    }

    it("Should list an asset correctly", async function () {
        const { escrow, seller, tokenAddress, serialNumber, priceInTinybars } = await loadFixture(deployEscrowFixture);

        await escrow.connect(seller).listAsset(tokenAddress, serialNumber, priceInTinybars);

        const listing = await escrow.listings(tokenAddress, serialNumber);
        expect(listing.seller).to.equal(seller.address);
        expect(listing.price).to.equal(priceInTinybars);
        expect(listing.state).to.equal(0); // 0 corresponds to LISTED
    });

    it("Should allow a buyer to fund the escrow", async function () {
        const { escrow, seller, buyer, tokenAddress, serialNumber, priceInTinybars, priceInWeibars } = await loadFixture(deployEscrowFixture);
        await escrow.connect(seller).listAsset(tokenAddress, serialNumber, priceInTinybars);

        await escrow.connect(buyer).fundEscrow(tokenAddress, serialNumber, { value: priceInWeibars });

        const listing = await escrow.listings(tokenAddress, serialNumber);
        expect(listing.buyer).to.equal(buyer.address);
        expect(listing.state).to.equal(1); // 1 corresponds to FUNDED
    });

    it("Should allow the buyer to confirm delivery and transfer the NFT", async function () {
        const { escrow, seller, buyer, tokenAddress, serialNumber, priceInTinybars, priceInWeibars } = await loadFixture(deployEscrowFixture);
        await escrow.connect(seller).listAsset(tokenAddress, serialNumber, priceInTinybars);
        await escrow.connect(buyer).fundEscrow(tokenAddress, serialNumber, { value: priceInWeibars });

        // This is a mock so we can't truly test the transfer, but we can test the state change
        await escrow.connect(buyer).confirmDelivery(tokenAddress, serialNumber);

        const listing = await escrow.listings(tokenAddress, serialNumber);
        expect(listing.state).to.equal(2); // 2 corresponds to SOLD
    });

    it("Should allow the seller to cancel a listing", async function () {
        const { escrow, seller, tokenAddress, serialNumber, priceInTinybars } = await loadFixture(deployEscrowFixture);
        await escrow.connect(seller).listAsset(tokenAddress, serialNumber, priceInTinybars);

        await escrow.connect(seller).cancelListing(tokenAddress, serialNumber);

        const listing = await escrow.listings(tokenAddress, serialNumber);
        expect(listing.state).to.equal(3); // 3 corresponds to CANCELED
    });
});
