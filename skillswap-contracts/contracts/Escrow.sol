// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract Escrow is ReentrancyGuard {
    address public assetTokenAddress;

    enum ListingState {
        LISTED,
        FUNDED,
        SOLD,
        CANCELED
    }

    struct Listing {
        address seller;
        address buyer;
        uint256 price;
        ListingState state;
    }

    mapping(uint256 => Listing) public listings;

    // NEW: pending withdrawals for sellers (in weibars, the same unit used for payable)
    mapping(address => uint256) public pendingWithdrawals;

    event AssetListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event EscrowFunded(uint256 indexed tokenId, address indexed buyer);
    event SaleCompleted(uint256 indexed tokenId, address indexed seller, address indexed buyer);
    event ListingCanceled(uint256 indexed tokenId);

    // NEW: event to signal funds available to withdraw
    event PaymentReady(address indexed seller, uint256 amountWeibars);

    constructor(address _assetTokenAddress) {
        assetTokenAddress = _assetTokenAddress;
    }

    function listAsset(uint256 tokenId, uint256 priceInTinybars) external {
        IERC721 assetToken = IERC721(assetTokenAddress);
        require(assetToken.ownerOf(tokenId) == msg.sender, "Escrow: Only the owner can list the asset.");
        require(priceInTinybars > 0, "Escrow: Price must be greater than zero.");

        listings[tokenId] = Listing({
            seller: msg.sender,
            buyer: address(0), // Buyer is not known yet
            price: priceInTinybars, // Storing the price in tinybars (8 decimals)
            state: ListingState.LISTED
        });

        emit AssetListed(tokenId, msg.sender, priceInTinybars);
        console.log("Seller %s has listed Token ID %s for %s tinybars", msg.sender, tokenId, priceInTinybars);
    }

    function convertToTinybar(uint256 weibarAmount) internal pure returns (uint256) {
        return weibarAmount / (10**10);
    }

    function fundEscrow(uint256 tokenId) external payable {
        Listing storage listing = listings[tokenId];
        require(listing.state == ListingState.LISTED, "Escrow: Asset is not listed for sale.");
        uint256 paymentInTinybars = convertToTinybar(msg.value);
        require(paymentInTinybars == listing.price, "Escrow: Incorrect payment amount.");

        listing.buyer = msg.sender;
        listing.state = ListingState.FUNDED;

        emit EscrowFunded(tokenId, msg.sender);
        console.log("Buyer %s has funded the escrow for Token ID %s", msg.sender, tokenId);
    }

    function convertToWeibar(uint256 tinybarAmount) internal pure returns (uint256) {
        return tinybarAmount * (10**10);
    }

    // CHANGE: Use pull-payments. No direct .call to seller inside confirmDelivery.
    function confirmDelivery(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        IERC721 assetToken = IERC721(assetTokenAddress);

        require(msg.sender == listing.buyer, "Escrow: Only the buyer can confirm delivery.");
        require(listing.state == ListingState.FUNDED, "Escrow: Escrow is not funded.");

        // EFFECTS first: change state
        listing.state = ListingState.SOLD;

        // Compute seller pay amount (weibars)
        uint256 priceInWeibars = convertToWeibar(listing.price);

        // RECORD the payment for later withdrawal by seller
        pendingWithdrawals[listing.seller] += priceInWeibars;

        // INTERACTION: transfer NFT to buyer (external call)
        assetToken.safeTransferFrom(listing.seller, listing.buyer, tokenId);
        console.log("Asset NFT %s transferred to buyer %s", tokenId, listing.buyer);

        emit PaymentReady(listing.seller, priceInWeibars);
        emit SaleCompleted(tokenId, listing.seller, listing.buyer);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(msg.sender == listing.seller, "Escrow: Only the seller can cancel a listing.");
        require(listing.state == ListingState.LISTED, "Escrow: Listing is not in a cancelable state.");

        listing.state = ListingState.CANCELED;
        emit ListingCanceled(tokenId);
        console.log("Seller %s has canceled the listing for Token ID %s", msg.sender, tokenId);
    }

    function refundBuyer(uint256 tokenId) external nonReentrant {
        Listing storage listing = listings[tokenId];
        require(msg.sender == listing.buyer, "Escrow: Only the buyer can request a refund under specific conditions.");
        require(listing.state == ListingState.FUNDED, "Escrow: Asset is not funded.");

        // NOTE: simplified refund logic
        listing.state = ListingState.CANCELED;

        // compute wei value to refund
        uint256 refundWeibars = convertToWeibar(listing.price);

        // reset buyer before external call
        address buyerAddr = listing.buyer;
        listing.buyer = address(0);

        // Use pull pattern for refunds as well — credit the buyer's pendingWithdrawals
        pendingWithdrawals[buyerAddr] += refundWeibars;

        emit ListingCanceled(tokenId); // Re-using this event for simplicity
        console.log("Funds for Token ID %s credited for refund to buyer %s", tokenId, buyerAddr);
    }

    // NEW: withdraw function — sellers and buyers call this to pull their funds
    function withdrawPayments() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Escrow: No funds to withdraw.");

        // Zero the pending amount before sending to prevent reentrancy
        pendingWithdrawals[msg.sender] = 0;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Escrow: Withdraw transfer failed.");

        console.log("Withdrawn %s weibars to %s", amount, msg.sender);
    }

    // Optional helper to check pending balance (view)
    function pendingBalance(address who) external view returns (uint256) {
        return pendingWithdrawals[who];
    }
}
