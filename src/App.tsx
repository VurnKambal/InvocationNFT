import React, { useState, useEffect } from "react";
import Web3 from "web3";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import { Sparkles, ShoppingCart, Coins, PlusCircle } from "lucide-react";
import Gacha from "./Gacha";
import Collection from "./components/Collection";
import Marketplace from "./components/Marketplace";
import Create from "./components/Create";
import dinoCoinLogo from "../images/dinoCoinLogo.png";
import "./App.css";

function App() {
  
  const [account, setAccount] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [dinoCoins, setDinoCoins] = useState(20);

  useEffect(() => {
    async function loadWeb3() {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
        try {
          const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          setAccount(accounts[0]);
        } catch (error) {
          console.error("Failed to connect wallet:", error);
        }
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
        console.log(accounts);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900">
        {!account ? (
          <div className="flex justify-center relative">
            <div className="relative w-full h-screen overflow-hidden video-wrapper">
              <video
                src="images/Invocation.mp4"
                autoPlay
                muted
                loop
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
              <button
                onClick={connectWallet}
                className="btn absolute top-3/4 left-1/2 transform -translate-x-1/2 glow-button custom-font-size"
              >
                Connect to Metamask
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="sticky top-0 z-50 flex justify-between items-center bg-black bg-opacity-50 p-3 rounded-lg">
              <img
                src={dinoCoinLogo}
                alt="Dino Coin Logo"
                className="w-16 h-16 rounded-full border-2 border-yellow-400"
              />
              <h1 className="text-yellow-400 text-3xl font-extrabold tracking-wider">
                DinoNFT Gacha
              </h1>
              <div className="flex items-center space-x-4">
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold px-4 py-2 rounded-full flex items-center">
                  <Coins className="w-5 h-5 mr-2" />
                  <span>{dinoCoins}</span>
                </div>
                <button
                  onClick={connectWallet}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-full hover:from-pink-600 hover:to-purple-700 transition duration-300"
                >
                  {account
                    ? `${account.slice(0, 6)}...${account.slice(-4)}`
                    : "Connect Wallet"}
                </button>
                <Link
                  to="/"
                  className="bg-gradient-to-r from-blue-400 to-indigo-500 text-white px-4 py-2 rounded-full hover:from-blue-500 hover:to-indigo-600 transition duration-300"
                >
                  Gacha
                </Link>
                <Link
                  to="/collections"
                  className="bg-gradient-to-r from-green-400 to-blue-500 text-white px-4 py-2 rounded-full hover:from-green-500 hover:to-blue-600 transition duration-300"
                >
                  Collection
                </Link>
                <Link
                  to="/marketplace"
                  className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-4 py-2 rounded-full hover:from-orange-500 hover:to-red-600 transition duration-300"
                >
                  <ShoppingCart className="w-5 h-5 mr-2 inline" />
                  Marketplace
                </Link>
                <Link
                  to="/create"
                  className="bg-gradient-to-r from-green-400 to-teal-500 text-white px-4 py-2 rounded-full hover:from-green-500 hover:to-teal-600 transition duration-300"
                >
                  <PlusCircle className="w-5 h-5 mr-2 inline" />
                  Create
                </Link>
              </div>
            </header>

            <Routes>
              <Route path="/" element={<Gacha account={account} web3={web3} />} />
              <Route path="/collections" element={<Collection account={account} web3={web3} />} />
              <Route path="/marketplace" element={<Marketplace userAddress={account} onPurchase={() => {}} />} />
              <Route path="/create" element={<Create account={account} web3={web3} />} />
            </Routes>
          </>
        )}
      </div>
    </Router>
  );
}

export default App;
