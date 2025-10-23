// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol"; // For debugging
import "@hashgraph/smart-contracts/contracts/system-contracts/hedera-token-service/IHederaTokenService.sol";
import "@hashgraph/smart-contracts/contracts/system-contracts/HederaResponseCodes.sol";

contract AssetToken is ERC721, Ownable {
    uint256 private _nextTokenId;

    // Struct to hold asset metadata
    struct AssetData {
        string assetType;
        string quality;
        string location;
    }

    // Mapping from token ID to asset data
    mapping(uint256 => AssetData) public assetData;

    constructor() ERC721("Integro Asset", "INTA") Ownable(msg.sender) {}

    // Function to view the metadata for a specific token
    function getAssetData(uint256 tokenId) public view returns (AssetData memory) {
        // Calling ownerOf will revert if the token does not exist, which is the check we want.
        require(ownerOf(tokenId) != address(0), "AssetToken: Query for nonexistent token");
        return assetData[tokenId];
    }

    // Overloaded mint function to include asset metadata
    function safeMint(address to, string memory assetType, string memory quality, string memory location) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        // Store the metadata
        assetData[tokenId] = AssetData({
            assetType: assetType,
            quality: quality,
            location: location
        });
        console.log("Minted new Asset NFT with Token ID %s to address %s", tokenId, to);
    }

}