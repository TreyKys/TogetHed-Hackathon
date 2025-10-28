// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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
        uint256 price; // stored in the native unit (same as msg.value)
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

    // ------------------------------------------------------------
    // 1. Seller lists NFT for sale
    // ------------------------------------------------------------
    function listAsset(uint256 tokenId, uint256 priceInWei) external {
        IERC721 assetToken = IERC721(assetTokenAddress);
        require(assetToken.ownerOf(tokenId) == msg.sender, "Escrow: Only the owner can list the asset.");
        require(priceInWei > 0, "Escrow: Price must be greater than zero.");

        listings[tokenId] = Listing({
            seller: msg.sender,
            buyer: address(0),
            price: priceInWei,
            state: ListingState.LISTED
        });

        emit AssetListed(tokenId, msg.sender, priceInWei);
        console.log("Seller %s listed Token ID %s for %s wei", msg.sender, tokenId, priceInWei);
    }

    // ------------------------------------------------------------
    // 2. Buyer funds the escrow (must send exact value)
    // ------------------------------------------------------------
    function fundEscrow(uint256 tokenId) external payable {
        Listing storage listing = listings[tokenId];
        require(listing.state == ListingState.LISTED, "Escrow: Asset is not listed for sale.");
        require(msg.value == listing.price, "Escrow: Incorrect payment amount.");

        listing.buyer = msg.sender;
        listing.state = ListingState.FUNDED;

        emit EscrowFunded(tokenId, msg.sender);
        console.log("Buyer %s funded escrow for Token ID %s", msg.sender, tokenId);
    }

    // ------------------------------------------------------------
    // 3. Buyer confirms delivery — triggers payment + NFT transfer
    // ------------------------------------------------------------
    function confirmDelivery(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        IERC721 assetToken = IERC721(assetTokenAddress);

        require(msg.sender == listing.buyer, "Escrow: Only the buyer can confirm delivery.");
        require(listing.state == ListingState.FUNDED, "Escrow: Escrow not funded.");

        listing.state = ListingState.SOLD;

        // Send HBAR (native value) to the seller
        (bool sent, ) = payable(listing.seller).call{value: listing.price}("");
        require(sent, "Escrow: Failed to send HBAR to seller.");

        // Transfer NFT to buyer
        assetToken.safeTransferFrom(listing.seller, listing.buyer, tokenId);

        emit SaleCompleted(tokenId, listing.seller, listing.buyer);
        console.log("NFT %s transferred to buyer %s", tokenId, listing.buyer);
    }

    // ------------------------------------------------------------
    // 4. Buyer requests refund (simple MVP case)
    // ------------------------------------------------------------
    function refundBuyer(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(msg.sender == listing.buyer, "Escrow: Only buyer can refund.");
        require(listing.state == ListingState.FUNDED, "Escrow: Not funded.");

        listing.state = ListingState.CANCELED;

        (bool sent, ) = payable(listing.buyer).call{value: listing.price}("");
        require(sent, "Escrow: Refund failed.");

        emit ListingCanceled(tokenId);
        console.log("Funds for Token ID %s refunded to buyer %s", tokenId, msg.sender);
    }

    // ------------------------------------------------------------
    // 5. (Optional) Seller cancels before funding
    // ------------------------------------------------------------
    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(msg.sender == listing.seller, "Escrow: Only seller can cancel.");
        require(listing.state == ListingState.LISTED, "Escrow: Not cancelable.");

        listing.state = ListingState.CANCELED;
        emit ListingCanceled(tokenId);
        console.log("Seller %s canceled listing for Token ID %s", msg.sender, tokenId);
    }

    // ------------------------------------------------------------
    // 6. View helper (for frontend)
    // ------------------------------------------------------------
    function getListingPrice(uint256 tokenId) external view returns (uint256) {
        return listings[tokenId].price;
    }
}
