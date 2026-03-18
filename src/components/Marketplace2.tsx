import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { Character } from "./types";

interface MarketplaceProps {
  collection: Character[];
  userAddress: string; // Pass the user's Ethereum address as a prop
  onPurchase: (character: Character) => void;
}

const Marketplace: React.FC<MarketplaceProps> = ({
  collection,
  userAddress,
  onPurchase,
}) => {
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"price" | "rarity">("price");
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Initialize web3 and fetch ETH balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (userAddress) {
        try {
          // Check if the browser has injected web3 (like MetaMask)
          if (window.ethereum) {
            const web3 = new Web3(window.ethereum);

            // Request access to the user's wallet
            await window.ethereum.request({ method: "eth_requestAccounts" });

            // Fetch the balance in wei and convert it to ether
            const balance = await web3.eth.getBalance(userAddress);
            setEthBalance(Number(web3.utils.fromWei(balance, "ether")));
          } else {
            console.log("Please install MetaMask!");
          }
        } catch (error) {
          console.error("Error fetching ETH balance: ", error);
        }
      }
    };
    fetchBalance();
  }, [userAddress]);

  const sortedCharacters = [...collection].sort((a, b) => {
    if (sortBy === "price") {
      return a.price - b.price;
    } else {
      return b.rarity - a.rarity;
    }
  });

  const handlePurchase = (character: Character) => {
    if (ethBalance >= character.price) {
      onPurchase(character);
      setAlertMessage(`Successfully purchased ${character.name}!`);
    } else {
      setAlertMessage("Not enough ETH to make this purchase.");
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
          Your ETH Balance:{" "}
          <span className="text-yellow-400">{ethBalance.toFixed(4)} ETH</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCharacters.map((character) => (
          <div key={character.id} className="bg-gray-800 p-4 rounded-lg">
            <img
              src={character.image}
              alt={character.name}
              className="w-full h-48 object-cover rounded mb-2"
            />
            <h3 className="text-lg font-semibold text-white">
              {character.name}
            </h3>
            <p className="text-gray-300">Rarity: {character.rarity}</p>
            <p className="text-yellow-400 font-bold">
              Price: {character.price} ETH
            </p>
            <button
              onClick={() => handlePurchase(character)}
              className="mt-2 w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700 transition duration-300"
            >
              Purchase
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Marketplace;
