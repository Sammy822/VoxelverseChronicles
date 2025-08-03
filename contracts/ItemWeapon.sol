// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ItemWeapon
 * @dev This contract manages the creation and ownership of unique weapon items (NFTs).
 * Each weapon is unique based on its image IPFS hash.
 */
contract ItemWeapon {
    string public name = "ItemWeapon";
    string public symbol = "IWP";
    address public owner;
    uint256 public nextTokenId;

    struct Weapon {
        string itemName;
        string description;
        string image; // IPFS URL
        bool isUsed;
        address owner;
    }

    mapping(uint256 => Weapon) public weapons;
    mapping(address => uint256[]) public ownerWeapons;
    // Mapping to ensure each image hash is minted only once
    mapping(string => bool) public imageMinted;

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Mints a new weapon token.
     * Ensures that a weapon with the same image IPFS hash cannot be minted more than once.
     * @param to The address that will receive the minted weapon.
     * @param itemName The name of the weapon.
     * @param description A description of the weapon.
     * @param image The IPFS hash of the weapon's image.
     */
    function mintWeapon(
        address to,
        string memory itemName,
        string memory description,
        string memory image
    ) public {
        // Require that the weapon (identified by its image hash) has not been minted before.
        require(!imageMinted[image], "This weapon has already been minted.");

        weapons[nextTokenId] = Weapon(itemName, description, image, false, to);
        ownerWeapons[to].push(nextTokenId);
        
        // Mark this image hash as minted
        imageMinted[image] = true;
        nextTokenId++;
    }

    /**
     * @dev Fetches all weapons owned by the message sender.
     * @return An array of Weapon structs owned by the caller.
     */
    function getMyWeapons() public view returns (Weapon[] memory) {
        uint256[] memory myIds = ownerWeapons[msg.sender];
        Weapon[] memory myWeapons = new Weapon[](myIds.length);

        for (uint i = 0; i < myIds.length; i++) {
            myWeapons[i] = weapons[myIds[i]];
        }

        return myWeapons;
    }

    /**
     * @dev Allows the owner of a weapon to mark it as used.
     * @param tokenId The ID of the weapon to mark as used.
     */
    function markAsUsed(uint256 tokenId) public {
        require(weapons[tokenId].owner == msg.sender, "Not your weapon");
        weapons[tokenId].isUsed = true;
    }

    /**
     * @dev A more explicit function for using a weapon, which also marks it as used.
     * @param tokenId The ID of the weapon to use.
     */
    function useWeapon(uint256 tokenId) public {
        require(weapons[tokenId].owner == msg.sender, "Not the owner");
        require(!weapons[tokenId].isUsed, "Weapon already used");
        weapons[tokenId].isUsed = true;
    }

    /**
     * @dev Fetches the details of a specific weapon.
     * @param tokenId The ID of the weapon.
     * @return The Weapon struct for the given ID.
     */
    function getWeapon(uint256 tokenId) public view returns (Weapon memory) {
        return weapons[tokenId];
    }
}