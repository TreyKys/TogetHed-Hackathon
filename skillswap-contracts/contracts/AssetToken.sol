// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AssetToken is ERC721, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("TogetHed Asset", "TGA") Ownable(msg.sender) {}

    // Only the owner of the contract (our backend) can mint new asset tokens
    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
    }
}
