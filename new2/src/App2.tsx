import React, { useState, useEffect } from "react";
import Web3 from "web3";
import Gacha from "./Gacha";
import "./App.css";

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);

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

  return (
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
        <Gacha account={account} web3={web3} />
      )}
    </div>
  );
}

export default App;