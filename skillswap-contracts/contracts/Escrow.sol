// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

contract Escrow {
    // A single Escrow contract can now handle multiple AssetToken contracts
    // The assetTokenAddress has been removed from a global variable

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

    // Key is a hash of the token address and the token ID to uniquely identify a listing
    mapping(bytes32 => Listing) public listings;

    event AssetListed(address indexed assetToken, uint256 indexed tokenId, address indexed seller, uint256 price);
    event EscrowFunded(address indexed assetToken, uint256 indexed tokenId, address indexed buyer);
    event SaleCompleted(address indexed assetToken, uint256 indexed tokenId, address seller, address buyer);
    event ListingCanceled(address indexed assetToken, uint256 indexed tokenId);

    constructor() {
        // Constructor no longer needs the asset token address
    }

    // --- Helper to get a unique key for a listing ---
    function getListingKey(address assetTokenAddress, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(assetTokenAddress, tokenId));
    }

    function listAsset(address assetTokenAddress, uint256 tokenId, uint256 priceInTinybars) external {
        IERC721 assetToken = IERC721(assetTokenAddress);
        require(assetToken.ownerOf(tokenId) == msg.sender, "Escrow: Only the owner can list the asset.");
        require(assetToken.getApproved(tokenId) == address(this), "Escrow: Contract must be approved to transfer the asset.");
        require(priceInTinybars > 0, "Escrow: Price must be greater than zero.");

        bytes32 key = getListingKey(assetTokenAddress, tokenId);
        listings[key] = Listing({
            seller: msg.sender,
            buyer: address(0),
            price: priceInTinybars,
            state: ListingState.LISTED
        });

        emit AssetListed(assetTokenAddress, tokenId, msg.sender, priceInTinybars);
        console.log("Seller has listed a token.");
    }

    function convertToTinybar(uint256 weibarAmount) internal pure returns (uint256) {
        return weibarAmount / (10**10);
    }

    function fundEscrow(address assetTokenAddress, uint256 tokenId) external payable {
        bytes32 key = getListingKey(assetTokenAddress, tokenId);
        Listing storage listing = listings[key];

        require(listing.state == ListingState.LISTED, "Escrow: Asset is not listed for sale.");
        uint256 paymentInTinybars = convertToTinybar(msg.value);
        require(paymentInTinybars == listing.price, "Escrow: Incorrect payment amount.");

        listing.buyer = msg.sender;
        listing.state = ListingState.FUNDED;

        emit EscrowFunded(assetTokenAddress, tokenId, msg.sender);
        console.log("Buyer has funded the escrow.");
    }

    function convertToWeibar(uint256 tinybarAmount) internal pure returns (uint256) {
        return tinybarAmount * (10**10);
    }

    function confirmDelivery(address assetTokenAddress, uint256 tokenId) external {
        bytes32 key = getListingKey(assetTokenAddress, tokenId);
        Listing storage listing = listings[key];
        IERC721 assetToken = IERC721(assetTokenAddress);

        require(msg.sender == listing.buyer, "Escrow: Only the buyer can confirm delivery.");
        require(listing.state == ListingState.FUNDED, "Escrow: Escrow is not funded.");

        listing.state = ListingState.SOLD;

        // 1. Transfer HBAR to the seller
        uint256 priceInWeibars = convertToWeibar(listing.price);
        (bool sent, ) = payable(listing.seller).call{value: priceInWeibars}("");
        require(sent, "Escrow: Failed to send HBAR to seller.");
        console.log("HBAR sent to seller.");

        // 2. Transfer NFT to the buyer
        assetToken.safeTransferFrom(listing.seller, listing.buyer, tokenId);
        console.log("Asset NFT transferred to buyer.");

        emit SaleCompleted(assetTokenAddress, tokenId, listing.seller, listing.buyer);
    }

    function cancelListing(address assetTokenAddress, uint256 tokenId) external {
        bytes32 key = getListingKey(assetTokenAddress, tokenId);
        Listing storage listing = listings[key];
        require(msg.sender == listing.seller, "Escrow: Only the seller can cancel a listing.");
        require(listing.state == ListingState.LISTED, "Escrow: Listing is not in a cancelable state.");

        listing.state = ListingState.CANCELED;
        emit ListingCanceled(assetTokenAddress, tokenId);
        console.log("Seller has canceled listing.");
    }

    function refundBuyer(address assetTokenAddress, uint256 tokenId) external {
        bytes32 key = getListingKey(assetTokenAddress, tokenId);
        Listing storage listing = listings[key];
        require(msg.sender == listing.buyer, "Escrow: Only the buyer can request a refund under specific conditions.");
        require(listing.state == ListingState.FUNDED, "Escrow: Asset is not funded.");

        listing.state = ListingState.CANCELED;

        (bool sent, ) = payable(listing.buyer).call{value: listing.price}("");
        require(sent, "Escrow: Failed to refund HBAR to buyer.");

        emit ListingCanceled(assetTokenAddress, tokenId); // Re-using event
        console.log("Funds refunded to buyer.");
    }
}