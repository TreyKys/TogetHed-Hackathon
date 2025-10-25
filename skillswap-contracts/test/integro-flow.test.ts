import { expect } from "chai";
import { ethers } from "hardhat";
import "dotenv/config";

describe("Integro Golden Path End-to-End Test", function () {

    it("Should execute the full transaction lifecycle correctly", async function () {
        this.timeout(180000); // Set a longer timeout for live network tests

        const [owner] = await ethers.getSigners();

        if (!process.env.SELLER_PRIVATE_KEY || !process.env.BUYER_PRIVATE_KEY) {
            throw new Error("SELLER_PRIVATE_KEY and BUYER_PRIVATE_KEY must be set in .env file");
        }
        const seller = new ethers.Wallet(process.env.SELLER_PRIVATE_KEY, ethers.provider);
        const buyer = new ethers.Wallet(process.env.BUYER_PRIVATE_KEY, ethers.provider);

        console.log(`Funding seller and buyer accounts for the test...`);
        // Use 18-decimal "weibar" format for funding transactions
        const sellerFundValue = ethers.parseEther("10");
        const buyerFundValue = ethers.parseEther("60");
        await (await owner.sendTransaction({ to: seller.address, value: sellerFundValue })).wait();
        await (await owner.sendTransaction({ to: buyer.address, value: buyerFundValue })).wait();
        console.log("Funding complete.");

        console.log("Deploying contracts...");
        const AssetToken = await ethers.getContractFactory("AssetToken", owner);
        const assetToken = await AssetToken.deploy();
        await assetToken.waitForDeployment();
        const assetTokenAddress = await assetToken.getAddress();

        const Escrow = await ethers.getContractFactory("Escrow", owner);
        const escrow = await Escrow.deploy();
        await escrow.waitForDeployment();
        const escrowAddress = await escrow.getAddress();

        console.log(`Contracts deployed. AssetToken at: ${assetTokenAddress}, Escrow at: ${escrowAddress}`);

        // **THE CRITICAL DISTINCTION**
        // For contract parameters, we use the precise 8-decimal tinybar amount.
        const salePriceInTinybars = BigInt(50 * 1e8);
        // For the transaction `value` field, we use the 18-decimal "weibar" equivalent.
        const salePriceTxValue = ethers.parseEther("50");

        const tokenId = 0;
        const assetMetadata = {
            assetType: "Yam Harvest Future",
            quality: "Grade A",
            location: "Ikorodu"
        };

        console.log("\nSTEP 1: Minting RWA NFT...");
        const mintTx = await assetToken.connect(owner).safeMint(seller.address, assetMetadata.assetType, assetMetadata.quality, assetMetadata.location);
        await mintTx.wait();
        expect(await assetToken.ownerOf(tokenId)).to.equal(seller.address);
        console.log(`Mint successful.`);

        console.log("\nSTEP 2: Listing asset on Escrow...");
        await (await assetToken.connect(seller).approve(escrowAddress, tokenId)).wait();
        console.log(`Seller approved Escrow contract.`);

        // The seller lists the asset, passing the price in 8-decimal TINYBARS.
        const listTx = await escrow.connect(seller).listAsset(assetTokenAddress, tokenId, salePriceInTinybars);
        await listTx.wait();

        const listingKey = await escrow.getListingKey(assetTokenAddress, tokenId);
        const listing = await escrow.listings(listingKey);
        expect(listing.seller).to.equal(seller.address);
        expect(listing.price).to.equal(salePriceInTinybars); // Verify tinybar amount
        console.log(`Listing successful. Price stored as ${listing.price} tinybars.`);

        console.log("\nSTEP 3: Buyer funding the Escrow...");
        const sellerInitialBalance = await ethers.provider.getBalance(seller.address);
        const buyerInitialBalance = await ethers.provider.getBalance(buyer.address);

        // Buyer funds the escrow, sending the `value` in 18-decimal WEIBARS.
        // The contract will receive this as `msg.value` converted to tinybars.
        const fundTx = await escrow.connect(buyer).fundEscrow(assetTokenAddress, tokenId, { value: salePriceTxValue });
        await fundTx.wait();

        const listingAfterFunding = await escrow.listings(listingKey);
        expect(listingAfterFunding.state).to.equal(1); // Enum State.FUNDED

        // Balance checks must use the 18-decimal value.
        const escrowBalance = await ethers.provider.getBalance(escrowAddress);
        expect(escrowBalance).to.equal(salePriceTxValue);
        console.log(`Funding successful. Escrow now holds ${ethers.formatEther(escrowBalance)} HBAR.`);

        console.log("\nSTEP 4: Buyer confirming delivery...");
        const confirmTx = await escrow.connect(buyer).confirmDelivery(assetTokenAddress, tokenId);
        const txReceipt = await confirmTx.wait();
        if(!txReceipt) throw new Error("Transaction receipt not found for confirmDelivery");
        console.log("Delivery confirmed.");

        console.log("\nFINAL VERIFICATION:");

        expect(await assetToken.ownerOf(tokenId)).to.equal(buyer.address);
        console.log(`- Ownership Verified: Buyer now owns Token ID ${tokenId}.`);

        const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
        const buyerFinalBalance = await ethers.provider.getBalance(buyer.address);

        expect(sellerFinalBalance).to.equal(sellerInitialBalance + salePriceTxValue);
        console.log(`- Seller Balance Verified.`);

        const gasUsed = BigInt(txReceipt.gasUsed) * BigInt(txReceipt.gasPrice);
        const expectedBuyerFinalBalance = buyerInitialBalance - salePriceTxValue - gasUsed;
        expect(buyerFinalBalance).to.be.closeTo(expectedBuyerFinalBalance, ethers.parseEther("0.1"));
        console.log(`- Buyer Balance Verified.`);

        const finalListing = await escrow.listings(listingKey);
        expect(finalListing.state).to.equal(2); // Enum State.SOLD
        const finalEscrowBalance = await ethers.provider.getBalance(escrowAddress);
        expect(finalEscrowBalance).to.equal(0);
        console.log("- Escrow State Verified.");

        console.log("\n✅ Golden Path Test Complete: Success!");
    });
});