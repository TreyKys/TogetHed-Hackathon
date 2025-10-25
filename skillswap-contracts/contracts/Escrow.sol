// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IHRC721.sol";
import "hardhat/console.sol";

contract Escrow {
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

    mapping(address => mapping(uint64 => Listing)) public listings;

    event AssetListed(address indexed tokenAddress, uint64 indexed serialNumber, address indexed seller, uint256 price);
    event EscrowFunded(address indexed tokenAddress, uint64 indexed serialNumber, address indexed buyer);
    event SaleCompleted(address indexed tokenAddress, uint64 indexed serialNumber, address seller, address buyer);
    event ListingCanceled(address indexed tokenAddress, uint64 indexed serialNumber);

    function listAsset(address tokenAddress, uint64 serialNumber, uint256 priceInTinybars) external {
        require(priceInTinybars > 0, "Escrow: Price must be greater than zero.");

        listings[tokenAddress][serialNumber] = Listing({
            seller: msg.sender,
            buyer: address(0), // Buyer is not known yet
            price: priceInTinybars, // Storing the price in tinybars (8 decimals)
            state: ListingState.LISTED
        });

        emit AssetListed(tokenAddress, serialNumber, msg.sender, priceInTinybars);
        console.log("Seller has listed a token.");
    }

    function convertToTinybar(uint256 weibarAmount) internal pure returns (uint256) {
        return weibarAmount / (10**10);
    }

    function fundEscrow(address tokenAddress, uint64 serialNumber) external payable {
        Listing storage listing = listings[tokenAddress][serialNumber];
        require(listing.state == ListingState.LISTED, "Escrow: Asset is not listed for sale.");
        uint256 paymentInTinybars = convertToTinybar(msg.value);
        require(paymentInTinybars == listing.price, "Escrow: Incorrect payment amount.");

        listing.buyer = msg.sender;
        listing.state = ListingState.FUNDED;

        emit EscrowFunded(tokenAddress, serialNumber, msg.sender);
        console.log("Buyer has funded the escrow.");
    }

    function convertToWeibar(uint256 tinybarAmount) internal pure returns (uint256) {
        return tinybarAmount * (10**10);
    }

    function confirmDelivery(address tokenAddress, uint64 serialNumber) external {
        Listing storage listing = listings[tokenAddress][serialNumber];

        require(msg.sender == listing.buyer, "Escrow: Only the buyer can confirm delivery.");
        require(listing.state == ListingState.FUNDED, "Escrow: Escrow is not funded.");

        listing.state = ListingState.SOLD;

        // 1. Transfer HBAR to the seller
        uint256 priceInWeibars = convertToWeibar(listing.price);
        (bool sent, ) = payable(listing.seller).call{value: priceInWeibars}("");
        require(sent, "Escrow: Failed to send HBAR to seller.");
        console.log("HBAR sent to seller.");

        // 2. Transfer NFT to the buyer using HTS precompile
        IHRC721(tokenAddress).transferFrom(listing.seller, listing.buyer, serialNumber);
        console.log("Asset NFT transferred to buyer.");

        emit SaleCompleted(tokenAddress, serialNumber, listing.seller, listing.buyer);
    }

    function cancelListing(address tokenAddress, uint64 serialNumber) external {
        Listing storage listing = listings[tokenAddress][serialNumber];
        require(msg.sender == listing.seller, "Escrow: Only the seller can cancel a listing.");
        require(listing.state == ListingState.LISTED, "Escrow: Listing is not in a cancelable state.");

        listing.state = ListingState.CANCELED;
        emit ListingCanceled(tokenAddress, serialNumber);
        console.log("Seller has canceled the listing.");
    }

    function refundBuyer(address tokenAddress, uint64 serialNumber) external {
        Listing storage listing = listings[tokenAddress][serialNumber];
        require(msg.sender == listing.buyer, "Escrow: Only the buyer can request a refund under specific conditions.");
        require(listing.state == ListingState.FUNDED, "Escrow: Asset is not funded.");

        // NOTE: This is a simplified refund logic. A real-world scenario would need
        // a more robust dispute resolution mechanism. For this test, we assume the
        // seller has gone AWOL and the buyer can reclaim funds.

        listing.state = ListingState.CANCELED;

        (bool sent, ) = payable(listing.buyer).call{value: listing.price}("");
        require(sent, "Escrow: Failed to refund HBAR to buyer.");

        emit ListingCanceled(tokenAddress, serialNumber); // Re-using this event for simplicity
        console.log("Funds for Token refunded to buyer.");
    }
}