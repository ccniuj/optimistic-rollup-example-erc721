// SPDX-License-Identifier: MIT

pragma solidity >0.6.0 <0.8.0;

import { ERC721 } from "./libraries/ERC721.sol";
import "./libraries/ERC721URIStorage.sol";

contract ExampleToken is ERC721URIStorage {
    address owner;
    uint256 private _totalSupply;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor (string memory name_, string memory symbol_) ERC721(name_, symbol_) {
        _totalSupply = 0;
        owner = msg.sender;
    }

    function mintToken(address receiver, string memory tokenURI)
        public
        onlyOwner
        returns (uint256)
    {
        uint256 tokenID = _totalSupply + 1;

        _mint(receiver, tokenID);
        _setTokenURI(tokenID, tokenURI);
        _totalSupply = tokenID;

        return tokenID;
    }
}
