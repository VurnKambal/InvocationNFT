// SPDX-License-Identifier: HAU
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract GachaCollectible is ERC721Enumerable, Ownable {
    // Constants
    uint256 public constant PULL_PRICE = 0.005 ether;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant MULTI_PULL_COUNT = 10;
    uint256 public constant MULTI_PULL_PRICE = PULL_PRICE * MULTI_PULL_COUNT;
    uint256 public constant PITY_THRESHOLD = 90;
    uint256 public constant LISTING_FEE_PERCENTAGE = 2; // 2% listing fee
    uint256 public constant ARTIST_COMMISSION_PERCENTAGE = 1; // 1% artist commission
    uint256 public constant MINT_FEE = 0.001 ether;

    // Enums
    enum Rarity { Star1, Star2, Star3, Star4, Star5, Star6}

    // Structs
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    // State variables
    uint256 private _tokenIds;
    uint256[] private _availableTokens;
    mapping(uint256 => string) private _tokenURIMap;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Rarity) public tokenRarity;
    mapping(address => uint256) private _pullsSinceLegendary;

    // Events
    event TokenMinted(uint256 indexed tokenId, address indexed owner, Rarity rarity);
    event TokenListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event TokenSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event GachaPulled(address indexed player, uint256[] tokenIds, Rarity[] rarities);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event CardMinted(address indexed recipient, uint256 tokenId, string tokenURI, Rarity rarity);

    constructor(address initialOwner) ERC721("GachaCollectible", "GCH") Ownable(initialOwner) {}

    // Admin functions
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Public functions
    function pullGacha() external payable returns (uint256) {
        require(msg.value >= PULL_PRICE, "Insufficient payment");
        require(_availableTokens.length > 0, "No characters available");
        uint256 tokenId = _pullSingleGacha();
        
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        Rarity[] memory rarities = new Rarity[](1);
        rarities[0] = tokenRarity[tokenId];
        
        emit GachaPulled(msg.sender, tokenIds, rarities);
        
        return tokenId;
    }

    function multiPullGacha() external payable returns (uint256[] memory) {
        require(msg.value >= MULTI_PULL_PRICE, "Insufficient payment");
        require(_availableTokens.length >= MULTI_PULL_COUNT, "Not enough characters for multi-pull");

        uint256[] memory newItemIds = new uint256[](MULTI_PULL_COUNT);
        Rarity[] memory rarities = new Rarity[](MULTI_PULL_COUNT);

        for (uint256 i = 0; i < MULTI_PULL_COUNT; i++) {
            newItemIds[i] = _pullSingleGacha();
            rarities[i] = tokenRarity[newItemIds[i]];
        }

        emit GachaPulled(msg.sender, newItemIds, rarities);

        return newItemIds;
    }

    function listForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        _approve(address(this), tokenId, msg.sender);
        
        require(getApproved(tokenId) == address(this), "Contract not approved");
        require(price > 0, "Price must be greater than 0");
    
        listings[tokenId] = Listing(msg.sender, price, true);
        emit TokenListed(tokenId, msg.sender, price);
    }

    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        require(listings[tokenId].active, "Listing not active");

        delete listings[tokenId];
        emit ListingCancelled(tokenId, msg.sender);
    }

    function buyListed(uint256 tokenId) external payable {
        Listing memory listing = listings[tokenId];
        require(listing.active, "Not listed for sale");
        require(msg.value >= listing.price, "Insufficient payment");

        uint256 listingFee = (listing.price * LISTING_FEE_PERCENTAGE) / 100;
        uint256 artistCommission = (listing.price * ARTIST_COMMISSION_PERCENTAGE) / 100;
        uint256 sellerProceeds = listing.price - listingFee - artistCommission;

        delete listings[tokenId];
        _transfer(listing.seller, msg.sender, tokenId);
        
        payable(listing.seller).transfer(sellerProceeds);
        payable(owner()).transfer(listingFee);
        // Assuming the contract owner manages artist payments
        payable(owner()).transfer(artistCommission);

        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        emit TokenSold(tokenId, listing.seller, msg.sender, listing.price);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "URI query for nonexistent token");
        return _tokenURIMap[tokenId];
    }

    function getRarity(uint256 tokenId) external view returns (Rarity) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenRarity[tokenId];
    }

    // Admin function to mint characters
    function mintCard(string memory _tokenURI, Rarity rarity) external payable {
        require(msg.sender != owner() && msg.value >= MINT_FEE, "Insufficient mint fee");
        
        require(_tokenIds < MAX_SUPPLY, "Max supply reached");
        
        _tokenIds++;
        uint256 newItemId = _tokenIds;
        _safeMint(owner(), newItemId);
        _tokenURIMap[newItemId] = _tokenURI;
        tokenRarity[newItemId] = rarity;
        _availableTokens.push(newItemId);

        emit CardMinted(msg.sender, newItemId, _tokenURI, rarity);
        emit TokenMinted(newItemId, msg.sender, rarity);
    }

    // Private functions
    function _pullSingleGacha() private returns (uint256) {
        uint256 randomValue = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, _tokenIds)));
        uint256 index = randomValue % _availableTokens.length;
        uint256 tokenId = _availableTokens[index];

        // Remove the token from available tokens
        _availableTokens[index] = _availableTokens[_availableTokens.length - 1];
        _availableTokens.pop();

        // Transfer the token from owner to player
        _transfer(owner(), msg.sender, tokenId);

        Rarity rarity = tokenRarity[tokenId];
        if (rarity == Rarity.Star5) {
            _pullsSinceLegendary[msg.sender] = 0;
        } else {
            _pullsSinceLegendary[msg.sender]++;
        }

        emit TokenMinted(tokenId, msg.sender, rarity);

        return tokenId;
    }

    // Public view functions
    function getAvailableTokensCount() public view returns (uint256) {
        return _availableTokens.length;
    }

    function getPullsSinceLegendary(address player) public view returns (uint256) {
        return _pullsSinceLegendary[player];
    }

    function getTokensOfOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        for (uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokens;
    }

    function getTokenListing(uint256 tokenId) external view returns (address seller, uint256 price, bool active) {
        Listing memory listing = listings[tokenId];
        return (listing.seller, listing.price, listing.active);
    }

    // New function to check if a token is listed
    function isTokenListed(uint256 tokenId) public view returns (bool) {
        return listings[tokenId].active;
    }

    // Add a function for the owner to withdraw accumulated fees
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }

}
