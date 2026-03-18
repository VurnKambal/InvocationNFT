import React, { useState, useEffect, useRef } from "react";
import Web3 from "web3";
import { AbiItem } from 'web3-utils';
import { Sparkles } from "lucide-react";
import GachaCard from "./components/GachaCard";
import { Character, Item, Metadata } from "./types";
import { abi as GachaCollectibleABI } from '../../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json';
import axios from 'axios';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';

interface GachaProps {
  account: string;
  web3: Web3 | null;
}

type PulledItem = Character | Item;

function Gacha({ account, web3 }: GachaProps) {
  const [contract, setContract] = useState<any>(null);
  const [pulledItems, setPulledItems] = useState<PulledItem[]>([]);
  const [nonce, setNonce] = useState<number | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [newlyPulledItem, setNewlyPulledItem] = useState<PulledItem | null>(null);
  const [multiPullItems, setMultiPullItems] = useState<PulledItem[]>([]);

  useEffect(() => {
    if (web3) {
      const contractInstance = new web3.eth.Contract(GachaCollectibleABI as AbiItem[], CONTRACT_ADDRESS);
      setContract(contractInstance);
    }
  }, [web3]);

  useEffect(() => {
    if (web3 && account) {
      updateNonce();
    }
  }, [web3, account]);

  const updateNonce = async () => {
    if (web3 && account) {
      const latestNonce = await web3.eth.getTransactionCount(account);
      setNonce(Number(latestNonce));
    }
  };

  const sendTransaction = async (method: any, value: string) => {
    if (!account || !web3 || !contract || nonce === null) {
      console.log("Not ready:", { account, web3: !!web3, contract: !!contract, nonce });
      return;
    }

    try {
      const gasEstimate = await method.estimateGas({
        from: account,
        value: value
      });

      const tx = await method.send({
        from: account,
        value: value,
        gas: BigInt(Math.floor(Number(gasEstimate) * 1.2)).toString(),
        gasPrice: await web3.eth.getGasPrice(),
        nonce: await web3.eth.getTransactionCount(account)
      });

      return tx;
    } catch (error) {
      console.error("Transaction failed:", error);
      await updateNonce();
      throw error;
    }
  };

  const fetchItemData = async (tokenId: string): Promise<PulledItem> => {
    try {
      const tokenURI = await contract.methods.tokenURI(tokenId).call();
      const cid = tokenURI.replace('ipfs://', '');
      const metadataResponse = await axios.get(`${PINATA_GATEWAY_URL}${cid}`);
      const metadata: Metadata = metadataResponse.data;
      const rarity = await contract.methods.getRarity(tokenId).call();

      console.log('Metadata:', metadata);

      if (!metadata || typeof metadata !== 'object') {
        throw new Error('Invalid metadata format');
      }

      const getAttribute = (traitType: string): string => {
        const attribute = metadata.attributes.find(attr => attr.trait_type === traitType);
        return attribute ? String(attribute.value) : 'Unknown';
      };

      const isCharacter = getAttribute('Element') !== 'Unknown';

      const item: PulledItem = {
        id: Number(tokenId),
        name: metadata.name || `Item #${tokenId}`,
        rarity: Number(rarity) + 1,
        image: metadata.image.replace('ipfs://', PINATA_GATEWAY_URL),
        ...(isCharacter
          ? {
              element: getAttribute('Element'),
              weapon: getAttribute('Weapon'),
              faction: getAttribute('Faction'),
            }
          : {
              category: getAttribute('Category'),
            }),
      };

      return item;
    } catch (error) {
      console.error("Error fetching item data:", error);
      throw error;
    }
  };

  const pullGacha = async () => {
    if (!contract) return;

    try {
      const pullPrice = await contract.methods.PULL_PRICE().call();
      const transaction = await sendTransaction(contract.methods.pullGacha(), pullPrice);
      
      const gachaPulledEvent = transaction.events.GachaPulled;
      const tokenIds = gachaPulledEvent.returnValues.tokenIds;

      const newItem = await fetchItemData(tokenIds[0]);
      setNewlyPulledItem(newItem);

      // Set animation based on rarity
      let animation: string;
      switch (newItem.rarity) {
        case 6:
          animation = "images/gacha/radiance-multi.mp4";
          break;
        case 5:
          animation = "images/gacha/5star-single.mp4";
          break;
        case 4:
          animation = "images/gacha/4star-single.mp4";
          break;
        default:
          animation = "images/gacha/3star-single.mp4";
      }

      // Play the animation
      setIsAnimating(true);
      setCurrentAnimation(animation);
    } catch (error) {
      console.error("Failed to pull gacha:", error);
    }
  };

  const multiPullGacha = async () => {
    if (!contract) return;

    try {
      const multiPullPrice = await contract.methods.MULTI_PULL_PRICE().call();
      const transaction = await sendTransaction(contract.methods.multiPullGacha(), multiPullPrice);

      const gachaPulledEvent = transaction.events.GachaPulled;
      const tokenIds = gachaPulledEvent.returnValues.tokenIds;

      const newItems = await Promise.all(
        tokenIds.map((tokenId: string) => fetchItemData(tokenId))
      );

      console.log("Pulled items:", newItems);
      setMultiPullItems(newItems);

      // Determine the highest rarity among pulled items
      const highestRarity = Math.max(...newItems.map(item => item.rarity));

      // Set animation based on highest rarity
      let animation: string;
      if (highestRarity >= 5) {
        animation = "images/gacha/5star-multi.mp4";
      } else {
        animation = "images/gacha/4star-multi.mp4";
      }

      // Play the animation
      setIsAnimating(true);
      setCurrentAnimation(animation);
    } catch (error) {
      console.error("Failed to multi-pull gacha:", error);
    }
  };

  const handleVideoEnd = () => {
    console.log("Video ended. Duration:", videoDuration);
    setIsAnimating(false);
    if (newlyPulledItem) {
      setPulledItems([newlyPulledItem]);
      setNewlyPulledItem(null);
    } else if (multiPullItems.length > 0) {
      setPulledItems(multiPullItems);
      setMultiPullItems([]);
    }
  };

  return (
    <div className="flex flex-col justify-center">
      <img
        src="images/landing.png"
        alt="Landing"
        className="w-full h-auto"
      />

      <div className="relative w-full h-screen overflow-hidden video-wrapper">
        <video
          src="images/ROLL.mp4"
          autoPlay
          muted
          loop
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-none"
          style={{ width: "100vw", height: "100vh", objectFit: "cover" }}
        />

        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex space-x-4">
          <button
            onClick={pullGacha}
            className="bg-gradient-to-r from-blue-950 to-blue-900 text-white font-bold py-4 px-8 rounded-lg flex items-center space-x-2 hover:from-blue-500 hover:to-blue-600 transition duration-300 transform hover:scale-105"
          >
            <Sparkles className="w-5 h-5" />
            <span>1x Summon (0.005 ETH)</span>
            <Sparkles className="w-5 h-5" />
          </button>
          <button 
            onClick={multiPullGacha}
            className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold py-4 px-8 rounded-lg flex items-center space-x-2 hover:from-yellow-500 hover:to-orange-600 transition duration-300 transform hover:scale-105"
          >
            <Sparkles className="w-5 h-5" />
            <span>10x Summon (0.05 ETH)</span>
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isAnimating && currentAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <video
            ref={videoRef}
            src={currentAnimation}
            autoPlay
            muted
            onLoadedMetadata={() => {
              if (videoRef.current) {
                const duration = videoRef.current.duration * 1000;
                console.log("Video duration set:", duration);
                setVideoDuration(duration);
              }
            }}
            onEnded={handleVideoEnd}
            className="max-w-full max-h-full"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {!isAnimating && pulledItems.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            {pulledItems.length === 1 ? "Pulled Item" : "Pulled Items"}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {pulledItems.map((item) => (
              <GachaCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Gacha;
