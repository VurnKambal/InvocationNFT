// SPDX-License-Identifier: HAU
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";


contract GachaMarketplace is ERC721URIStorage{
    uint256 private _tokenIds;
    uint256 private _itemsSold;

    uint256 listingPrice = 0.0015 ether;
    address payable owner;


    struct MarketItem {
        uint256 tokenId;
        address payable seller;
        address payable owner;
        uint256 price;
        bool sold;
    }

    mapping(uint256 => MarketItem) public marketItem;
    
    event marketItemCreated(
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 price,
        bool sold
    );

    modifier onlyOwner{
        require(msg.sender == owner, "Only Owner of the Marketplace allowed");
        _;
    }

    constructor() ERC721("GachaCollectible", "GCH"){
        owner == payable(msg.sender);
    }


    function updateListingPrice(uint256 _listingPrice) 
        public
        payable 
        onlyOwner 
    {
        listingPrice = _listingPrice;
    }


    function getListingPrice() public view returns (uint256) {
        return listingPrice;
    }


    // Let create "CREATE NFT TOKEN FUNCTION"

    function createToken(string memory tokenURI, uint256 price) public payable returns(uint256) {
        _tokenIds++;

        uint256 newTokenId = _tokenIds;

        _mint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        createMarketItem(newTokenId, price);
        

        return newTokenId;
    }

    // CREATING MARKET ITEM
    function createMarketItem(uint256 tokenId, uint256 price) private {
        require(price > 0, "Price must be greater than 0");
        require(msg.value == listingPrice, "Price must be equals to Listing Price");
        
        marketItem[tokenId] = MarketItem(
            tokenId,
            payable(msg.sender),
            payable(address(this)),
            price,
            false
        );

        _transfer(msg.sender, address(this), tokenId);

        emit marketItemCreated(
            tokenId, 
            msg.sender, 
            address(this), 
            price,
            false
        );
    }


    // FUNCTION FOR RESALE TOKEN
    function resellToken(uint256 tokenId, uint256 price) public payable {
        require(marketItem[tokenId].owner == msg.sender, "Only item owner allowed");

        require(msg.value == listingPrice, "Price must be equals to Listing Price");

        marketItem[tokenId].sold = false;
        marketItem[tokenId].price = price;
        marketItem[tokenId].seller = payable(msg.sender);
        marketItem[tokenId].owner = payable(address(this));

        _itemsSold -= 1;

        _transfer(msg.sender, address(this), tokenId);
    }

    // FUNCTION CREATE MARKET SALE
    function createMarketSale(uint256 tokenId) public payable {
        uint256 price = marketItem[tokenId].price;

        require(msg.value == price, "Please give the exact price");

        marketItem[tokenId].owner = payable(msg.sender);
        marketItem[tokenId].sold = true;
        marketItem[tokenId].owner = payable(address(0));


        _itemsSold++;

        _transfer(address(this), msg.sender, tokenId);

        payable(owner).transfer(listingPrice);
        payable(marketItem[tokenId].seller).transfer(msg.value);

    }


    // GET UNSOLD NFT DATA
    function fetchMarketItem() public view returns(MarketItem[] memory) {
        uint256 itemCount = _tokenIds;
        uint256 unsoldItemCount = _tokenIds - _itemsSold;
        uint256 currentIndex = 0;

        MarketItem[] memory items = new MarketItem[](unsoldItemCount);
        for (uint256 i = 0; i < itemCount; i++) {
            uint256 currentId = i + 1;
            if (marketItem[currentId].owner == address(this)){
                MarketItem storage currentItem = marketItem[currentId];
                items[currentIndex] = currentItem;
                currentIndex++;
            }
        }
        return items;
    }

    // PURCHASE ITEM
    function fetchMyNFT() public view returns(MarketItem[] memory) {
        uint256 totalCount = _tokenIds;
        uint256 itemCount = 0;
        uint256 currentIndex = 0;

        uint256 currentId;
      

        MarketItem[] memory items = new MarketItem[](itemCount);
        for(uint256 i = 0; i < totalCount; i++) {
            currentId = i + 1;
            if (marketItem[currentId].owner == msg.sender){
                MarketItem storage currentItem = marketItem[currentId];
                items[currentIndex] = currentItem;

                currentIndex++;
                itemCount++;

            }
        }

        return items;

    }

    // SINGLE USER ITEMS
    function fetchItemsListed() public view returns(MarketItem[] memory) {
        uint256 totalCount = _tokenIds;
        uint256 itemCount = 0;
        uint256 currentIndex = 0;
        
        uint256 currentId;

        MarketItem[] memory items = new MarketItem[](itemCount);
        for(uint256 i = 0; i < totalCount; i++) {
            currentId = i + 1;
            if (marketItem[currentId].seller == msg.sender){
                MarketItem storage currentItem = marketItem[currentId];
                items[currentIndex] = currentItem;

                currentIndex++;
                itemCount++;

            }
        }

        return items;
    }


    // string[] private _tokenURIs;
    // mapping(string => bool) private _usedTokenURIs;
    // uint256 private _remainingTokenURIs;

    // // Add rarity levels
    // enum Rarity { Star0, Star1, Star2, Star3, Star4, Start5 }
    // mapping(uint256 => Rarity) public tokenRarity;

    // // Add pity system
    // uint256 public constant PITY_THRESHOLD = 90;                                                        
    // mapping(address => uint256) private _pullsSinceLegendary;

    // constructor(address initialOwner) ERC721("GachaCollectible", "GCH") Ownable(initialOwner) {
    //     _remainingTokenURIs = 0;
    // }

    // function addTokenURI(string memory tokenURI) public onlyOwner {
    //     require(!_usedTokenURIs[tokenURI], "TokenURI already exists");
    //     _tokenURIs.push(tokenURI);
    //     _remainingTokenURIs++;
    // }

    // function _pullSingleGacha() private returns (uint256) {
    //     require(_remainingTokenURIs > 0, "No more unique cards available");
        
    //     uint256 randomValue = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, _tokenIds)));
        
    //     // Implement pity system and rarity selection
    //     Rarity rarity;
    //     if (_pullsSinceLegendary[msg.sender] >= PITY_THRESHOLD || randomValue % 100 < 1) {
    //         rarity = Rarity.Legendary;
    //         _pullsSinceLegendary[msg.sender] = 0;
    //     } else {
    //         uint256 rarityRoll = randomValue % 100;
    //         if (rarityRoll < 60) rarity = Rarity.Common;
    //         else if (rarityRoll < 85) rarity = Rarity.Rare;
    //         else rarity = Rarity.Epic;
    //         _pullsSinceLegendary[msg.sender]++;
    //     }

    //     // Select tokenURI based on rarity (assuming tokenURIs are sorted by rarity)
    //     uint256 startIndex = uint256(rarity) * (_tokenURIs.length / 4);
    //     uint256 endIndex = startIndex + (_tokenURIs.length / 4);
    //     uint256 randomIndex = startIndex + (randomValue % (endIndex - startIndex));

    //     // Find the next available tokenURI within the rarity range
    //     while (_usedTokenURIs[_tokenURIs[randomIndex]]) {
    //         randomIndex = startIndex + ((randomIndex - startIndex + 1) % (endIndex - startIndex));
    //     }
        
    //     string memory tokenURI = _tokenURIs[randomIndex];
    //     _usedTokenURIs[tokenURI] = true;
    //     _remainingTokenURIs--;

    //     _tokenIds++;
    //     uint256 newItemId = _tokenIds;
    //     _safeMint(msg.sender, newItemId);
    //     _setTokenURI(newItemId, tokenURI);
    //     tokenRarity[newItemId] = rarity;

    //     return newItemId;
    // }

    // function pullGacha() public payable returns (uint256) {
    //     require(msg.value >= PULL_PRICE, "Insufficient payment");
    //     require(_tokenIds < MAX_SUPPLY, "Max supply reached");
    //     return _pullSingleGacha();
    // }

    // function listForSale(uint256 tokenId, uint256 price) public {
    //     require(ownerOf(tokenId) == msg.sender, "Not the owner");
    //     require(getApproved(tokenId) == address(this), "Contract not approved");

    //     listings[tokenId] = Listing(msg.sender, price);
    // }

    // function cancelListing(uint256 tokenId) public {
    //     require(listings[tokenId].seller == msg.sender, "Not the seller");
    //     delete listings[tokenId];
    // }

    // function buyListed(uint256 tokenId) public payable {
    //     Listing memory listing = listings[tokenId];
    //     require(listing.seller != address(0), "Not listed for sale");
    //     require(msg.value >= listing.price, "Insufficient payment");

    //     address seller = listing.seller;
    //     uint256 price = listing.price;

    //     delete listings[tokenId];
    //     _transfer(seller, msg.sender, tokenId);
    //     payable(seller).transfer(price);

    //     if (msg.value > price) {
    //         payable(msg.sender).transfer(msg.value - price);
    //     }
    // }

    // function withdraw() public onlyOwner {
    //     uint256 balance = address(this).balance;
    //     payable(owner()).transfer(balance);
    // }

    // function multiPullGacha() public payable returns (uint256[] memory) {
    //     require(msg.value >= MULTI_PULL_PRICE, "Insufficient payment");
    //     require(_tokenIds + MULTI_PULL_COUNT <= MAX_SUPPLY, "Not enough supply for multi-pull");
    //     require(_remainingTokenURIs >= MULTI_PULL_COUNT, "Not enough unique cards for multi-pull");

    //     uint256[] memory newItemIds = new uint256[](MULTI_PULL_COUNT);

    //     for (uint256 i = 0; i < MULTI_PULL_COUNT; i++) {
    //         newItemIds[i] = _pullSingleGacha();
    //     }

    //     return newItemIds;
    // }

    // function getRarity(uint256 tokenId) public view returns (Rarity) {
    //     require(_exists(tokenId), "Token does not exist");
    //     return tokenRarity[tokenId];
    // }
}
