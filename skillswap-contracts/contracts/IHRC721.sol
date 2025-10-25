// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

interface IHRC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
}
