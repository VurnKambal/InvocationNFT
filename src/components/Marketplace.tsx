import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { AbiItem } from 'web3-utils';
import { Character, Listing } from "../types";
import { abi as GachaCollectibleABI } from '../../../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json';
import { Star } from "lucide-react"; // Import the Star icon

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS; // Replace with your contract address
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';

interface MarketplaceProps {
  userAddress: string;
  onPurchase: (character: Character) => void;
}

const Marketplace: React.FC<MarketplaceProps> = ({ userAddress, onPurchase }) => {
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"price" | "rarity">("price");
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [marketplaceItems, setMarketplaceItems] = useState<Character[]>([]);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [contract, setContract] = useState<any>(null);

  useEffect(() => {
    const initWeb3 = async () => {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
        const contractInstance = new web3Instance.eth.Contract(GachaCollectibleABI as AbiItem[], CONTRACT_ADDRESS);
        setContract(contractInstance);

        await window.ethereum.request({ method: "eth_requestAccounts" });
        const balance = await web3Instance.eth.getBalance(userAddress);
        setEthBalance(Number(web3Instance.utils.fromWei(balance, "ether")));

      } else {
        console.log("Please install MetaMask!");
      }
    };
    initWeb3();
  }, [userAddress]);

  useEffect(() => {
    const fetchMarketplaceItems = async () => {
      if (!contract) return;

      try {
        const totalSupply = await contract.methods.totalSupply().call();
        const items: Character[] = [];

        for (let i = 1; i <= totalSupply; i++) {
          const listingDetails = await contract.methods.getTokenListing(i).call();
          if (listingDetails.active) {
            const tokenURI = await contract.methods.tokenURI(i).call();
            const cid = tokenURI.replace('ipfs://', '');
            const metadataResponse = await fetch(`${PINATA_GATEWAY_URL}${cid}`);
            const metadata = await metadataResponse.json();
            const rarity = await contract.methods.getRarity(i).call();

            items.push({
              id: i,
              name: metadata.name,
              rarity: Number(rarity) + 1,
              image: metadata.image.replace('ipfs://', PINATA_GATEWAY_URL),
              element: metadata.attributes.find((attr: any) => attr.trait_type === 'Element')?.value,
              weapon: metadata.attributes.find((attr: any) => attr.trait_type === 'Weapon')?.value,
              faction: metadata.attributes.find((attr: any) => attr.trait_type === 'Faction')?.value,
              price: Web3.utils.fromWei(listingDetails.price, 'ether'),
              seller: listingDetails.seller
            });
          }
        }

        setMarketplaceItems(items);
      } catch (error) {
        console.error("Error fetching marketplace items:", error);
      }
    };

    fetchMarketplaceItems();
  }, [contract]);

  const sortedCharacters = [...marketplaceItems].sort((a, b) => {
    if (sortBy === "price") {
      return Number(a.price) - Number(b.price);
    } else {
      return b.rarity - a.rarity;
    }
  });

  const handlePurchase = async (character: Character) => {
    if (!web3 || !contract) return;

    try {
      const priceInWei = web3.utils.toWei(character.price!.toString(), 'ether');

      // Purchase the NFT
      await contract.methods.buyListed(character.id).send({
        from: userAddress,
        value: priceInWei,
        nonce: await web3.eth.getTransactionCount(userAddress),
      });



      onPurchase(character);
      setAlertMessage(`Successfully purchased ${character.name}!`);

      // Refresh ETH balance
      const newBalance = await web3.eth.getBalance(userAddress);
      setEthBalance(Number(web3.utils.fromWei(newBalance, "ether")));

      // Remove the purchased item from the marketplace
      setMarketplaceItems(prevItems => prevItems.filter(item => item.id !== character.id));
    } catch (error) {
      console.error("Purchase failed:", error);
      setAlertMessage("Purchase failed. Please try again.");
    }

    setTimeout(() => setAlertMessage(null), 3000);
  };

  const handleUnlist = async (character: Character) => {
    if (!web3 || !contract) return;

    try {
      await contract.methods.cancelListing(character.id).send({
        from: userAddress,
        nonce: await web3.eth.getTransactionCount(userAddress),
      });

      setAlertMessage(`Successfully unlisted ${character.name}!`);

      // Remove the unlisted item from the marketplace
      setMarketplaceItems(prevItems => prevItems.filter(item => item.id !== character.id));
    } catch (error) {
      console.error("Unlisting failed:", error);
      setAlertMessage("Unlisting failed. Please try again.");
    }

    setTimeout(() => setAlertMessage(null), 3000);
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">
        Marketplace
      </h2>

      <div className="flex justify-between items-center mb-4">
        <div className="text-white">
          Your ETH Balance: <span className="text-yellow-400">{ethBalance.toFixed(4)} ETH</span>
        </div>
        <select
          className="bg-purple-700 text-white p-2 rounded"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "price" | "rarity")}
        >
          <option value="price">Sort by Price</option>
          <option value="rarity">Sort by Rarity</option>
        </select>
      </div>

      {alertMessage && (
        <div className="bg-blue-500 text-white p-4 rounded-md mb-4">
          <p className="font-bold">Notice</p>
          <p>{alertMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {sortedCharacters.map((character) => (
          <div key={character.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transform transition-all duration-300 hover:scale-105 w-52 sm:w-56 md:w-60 lg:w-64">
            <div className="relative pb-[133%]">
              <img
                src={character.image}
                alt={character.name}
                className="absolute top-0 left-0 w-full h-full object-cover rounded-t-lg"
              />
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-white truncate">
                {character.name}
              </h3>
              <div className="flex items-center mt-1">
                {Array.from({ length: character.rarity }).map((_, index) => (
                  <Star
                    key={index}
                    className="inline-block w-4 h-4 text-yellow-400 mr-1"
                  />
                ))}
              </div>
              <p className="text-lg text-yellow-400 font-bold mt-2">
                Price: {character.price} ETH
              </p>
              {character.seller.toLowerCase() === userAddress.toLowerCase() ? (
                <button
                  onClick={() => handleUnlist(character)}
                  className="mt-3 w-full bg-red-600 text-white text-base p-2 rounded hover:bg-red-700 transition duration-300"
                >
                  Unlist
                </button>
              ) : (
                <button
                  onClick={() => handlePurchase(character)}
                  className="mt-3 w-full bg-purple-600 text-white text-base p-2 rounded hover:bg-purple-700 transition duration-300"
                >
                  Purchase
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Marketplace;
