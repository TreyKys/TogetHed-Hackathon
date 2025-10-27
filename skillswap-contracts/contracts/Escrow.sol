// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

contract Escrow {
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

    event AssetListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event EscrowFunded(uint256 indexed tokenId, address indexed buyer);
    event SaleCompleted(uint256 indexed tokenId, address indexed seller, address indexed buyer);
    event ListingCanceled(uint256 indexed tokenId);

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

    function confirmDelivery(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        IERC721 assetToken = IERC721(assetTokenAddress);

        require(msg.sender == listing.buyer, "Escrow: Only the buyer can confirm delivery.");
        require(listing.state == ListingState.FUNDED, "Escrow: Escrow is not funded.");

        listing.state = ListingState.SOLD;

        // 1. Transfer HBAR to the seller
        uint256 priceInWeibars = convertToWeibar(listing.price);
        (bool sent, ) = payable(listing.seller).call{value: priceInWeibars}("");
        require(sent, "Escrow: Failed to send HBAR to seller.");
        console.log("HBAR sent to seller %s", listing.seller);

        // 2. Transfer NFT to the buyer
        assetToken.safeTransferFrom(listing.seller, listing.buyer, tokenId);
        console.log("Asset NFT %s transferred to buyer %s", tokenId, listing.buyer);

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

    function refundBuyer(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(msg.sender == listing.buyer, "Escrow: Only the buyer can request a refund under specific conditions.");
        require(listing.state == ListingState.FUNDED, "Escrow: Asset is not funded.");

        // NOTE: This is a simplified refund logic. A real-world scenario would need
        // a more robust dispute resolution mechanism. For this test, we assume the
        // seller has gone AWOL and the buyer can reclaim funds.

        listing.state = ListingState.CANCELED;

        (bool sent, ) = payable(listing.buyer).call{value: listing.price}("");
        require(sent, "Escrow: Failed to refund HBAR to buyer.");

        emit ListingCanceled(tokenId); // Re-using this event for simplicity
        console.log("Funds for Token ID %s refunded to buyer %s", tokenId, msg.sender);
    }
}