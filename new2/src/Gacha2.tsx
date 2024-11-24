import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { Sparkles, ShoppingCart } from "lucide-react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import GachaCard from "./components/GachaCard";
import Collection from "./components/Collection";
import Marketplace from "./components/Marketplace";
import { Character } from "./types";
import { characters } from "./data/characters";
import dinoCoinLogo from "../images/dinoCoinLogo.png";
import "./App.css";

function App() {
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
const [isAnimating, setIsAnimating] = useState(false);

  const [account, setAccount] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [pulledCharacter, setPulledCharacter] = useState<Character | null>(
    null
  );
  const [collection, setCollection] = useState<Character[]>([]);
  const [showCollection, setShowCollection] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);

  useEffect(() => {
    async function loadWeb3() {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
      }
    }
    loadWeb3();
  }, []);

  const connectWallet = async () => {
    if (web3) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    }
  };

  const pullGacha = async () => {
    console.log("Pulling")
    console.log(account, web3)
    if (!account || !web3) return;
  
    try {
      const transaction = {
        from: account,
        to: "0x0000000000000000000000000000000000000000", // Replace with correct address
        value: web3.utils.toWei("0.1", "ether"),
      };
      console.log("sending")
      await web3.eth.sendTransaction(transaction);
      console.log("sent")
      const randomIndex = Math.floor(Math.random() * characters.length);
      const newCharacter = characters[randomIndex];
      console.log(newCharacter)
      // Check for rarity and set the corresponding animation
      let animation: string;
      switch (newCharacter.rarity) {
        case 5:
          animation = "images/gacha/radiance-multi.mp4";
          break;
        case 4:
          animation = "images/gacha/5star-single.mp4";
          break;
        case 3:
          animation = "images/gacha/4star-single.mp4";
          break;
        default:
          animation = "images/gacha/3star-single.mp4";
      }
  
      // Play the animation and set the state
      setIsAnimating(true);
      setCurrentAnimation(animation);
  
      // Set a timeout to display the result after the animation ends
      setTimeout(() => {
        setIsAnimating(false);
        setPulledCharacter(newCharacter);
  
        if (!collection.some((char) => char.id === newCharacter.id)) {
          setCollection((prev) => [...prev, newCharacter]);
        } else {
          alert("You've already collected this character!");
        }
      }, 3000); // Assuming 3 seconds for the animation duration
    } catch (error) {
      console.error("Failed to pull gacha:", error);
    }
  };
  

  const handlePurchase = async (character: Character) => {
    if (!account || !web3) return;

    try {
      const transaction = {
        from: account,
        to: character.contractAddress, // Replace with the correct NFT contract address
        value: web3.utils.toWei(character.price.toString(), "ether"),
      };

      // Send the transaction to the blockchain
      await web3.eth.sendTransaction(transaction);

      // If purchase is successful, add the character to the user's collection
      if (!collection.some((char) => char.id === character.id)) {
        setCollection((prev) => [...prev, character]);
        alert(`You have successfully purchased ${character.name}!`);
      } else {
        alert("You already own this character!");
      }
    } catch (error) {
      console.error("Failed to purchase NFT:", error);
      alert("Purchase failed. Please try again.");
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-950 to-blue-950">
        <div className="flex flex-col justify-center">
          {/* Landing Image */}
          <img
            src="images/landing.png"
            alt="Landing"
            className="w-full h-auto"
          />
  
          {/* Video Background */}
          <div className="relative w-full h-screen overflow-hidden video-wrapper">
            <video
              src="images/ROLL.mp4"
              autoPlay
              muted
              loop
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-none"
              style={{ width: "100vw", height: "100vh", objectFit: "cover" }}
            />
  
            {/* Summon Button */}
            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
              <button
                onClick={pullGacha}
                className="bg-gradient-to-r from-blue-950 to-blue-900 text-white py-4 px-8 rounded-lg flex items-center space-x-2 hover:from-blue-950 hover:to-indigo-700 transition duration-300 transform hover:scale-105"
              >
                <Sparkles className="w-5 h-5" />
                <span>Summon</span>
                <Sparkles className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
  
        {/* Display Animation */}
        {isAnimating && currentAnimation && (
          <div className="absolute inset-0 flex justify-center items-center">
            <video
              src={currentAnimation}
              autoPlay
              muted
              className="w-full h-auto"
              style={{ objectFit: "cover" }}
            />
          </div>
        )}
  
        {/* Display Pulled Character after animation ends */}
        {!isAnimating && pulledCharacter && (
          <div className="mt-12 flex justify-center">
            <GachaCard character={pulledCharacter} />
          </div>
        )}
  
        {showCollection && (
          <div className="mt-10 bg-black bg-opacity-50 p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">
              Your NFT Collection
            </h2>
            <Collection collection={collection} />
          </div>
        )}
  
        {showMarketplace && (
          <div className="mt-10">
            <Marketplace collection={characters} onPurchase={handlePurchase} />
          </div>
        )}
      </div>
    </Router>
  );  
}

export default App;
