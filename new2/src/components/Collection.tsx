// src/components/Collection.tsx
import React, { useState, useEffect } from "react";
import { Character, Item, Metadata } from "../types"; // Adjust the import based on your project structure
import GachaCard from "./GachaCard"; // Import GachaCard from components
import Web3 from "web3";
import { AbiItem } from 'web3-utils';
import { abi as GachaCollectibleABI } from '../../../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json';
import axios from 'axios';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// Pinata gateway URL
const PINATA_GATEWAY_URL = 'https://gateway.pinata.cloud/ipfs/';

interface CollectionProps {
  account: string | null;
}

type CollectionItem = (Character | Item) & { isListed?: boolean; price?: string };

const Collection: React.FC<CollectionProps> = ({ account }) => {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [contract, setContract] = useState<any>(null);

  useEffect(() => {
    const initWeb3AndNonce = async () => {
      if (window.ethereum && account) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);
        const contractInstance = new web3Instance.eth.Contract(GachaCollectibleABI as AbiItem[], CONTRACT_ADDRESS);
        setContract(contractInstance);
        
      }
    };
    initWeb3AndNonce();
  }, [account]);

  useEffect(() => {
    const fetchCollection = async () => {
      if (!account || !contract) return;

      try {
        const tokenIds = await contract.methods.getTokensOfOwner(account).call();
        const items = await Promise.all(tokenIds.map(async (tokenId: string) => {
          const tokenURI = await contract.methods.tokenURI(tokenId).call();
          const cid = tokenURI.replace('ipfs://', '');
          
          const metadataResponse = await axios.get(`${PINATA_GATEWAY_URL}${cid}`);
          const metadata: Metadata = metadataResponse.data;
          
          const rarity = await contract.methods.getRarity(tokenId).call();
          const isListed = await contract.methods.isTokenListed(tokenId).call();
          let price = '0';
          if (isListed) {
            const listing = await contract.methods.getTokenListing(tokenId).call();
            price = web3?.utils.fromWei(listing.price, 'ether') || '0';
          }

          console.log('Metadata:', metadata);

          if (!metadata || typeof metadata !== 'object') {
            throw new Error('Invalid metadata format');
          }

          const getAttribute = (traitType: string): string => {
            const attribute = metadata.attributes.find(attr => attr.trait_type === traitType);
            return attribute ? String(attribute.value) : 'Unknown';
          };

          const isCharacter = getAttribute('Element') !== 'Unknown';

          const item: CollectionItem = {
            id: Number(tokenId),
            name: metadata.name || `Item #${tokenId}`,
            rarity: Number(rarity) + 1,
            image: metadata.image.replace('ipfs://', PINATA_GATEWAY_URL),
            isListed,
            price,
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
        }));

        setCollection(items);
      } catch (error) {
        console.error("Failed to fetch collection:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [account, contract, web3]);

  const openSellDialog = (item: CollectionItem) => {
    setSelectedItem(item);
    setShowDialog(true);
    setSellPrice(item.price || "");
  };

  const closeSellDialog = () => {
    setShowDialog(false);
    setSelectedItem(null);
    setSellPrice("");
  };

  const handleSellSubmit = async () => {
    if (!selectedItem || !web3 || !contract || !account) return;

    const priceInWei = web3.utils.toWei(sellPrice, 'ether');

    try {
      if (selectedItem.isListed) {
        // Unlist the item
        const unlistGasEstimate = await contract.methods.cancelListing(selectedItem.id).estimateGas({ from: account });
        
        await contract.methods.cancelListing(selectedItem.id).send({ 
          from: account, 
          gas: Math.floor(Number(unlistGasEstimate) * 1.1),
          nonce: await web3.eth.getTransactionCount(account)
        });

        alert(`Successfully unlisted ${selectedItem.name}`);
      } else {
        // List the item for sale
        // await contract.methods.approve(CONTRACT_ADDRESS, selectedItem.id).send({
        //   from: account,
        //   nonce: await web3.eth.getTransactionCount(account)
        // });
        const listGasEstimate = await contract.methods.listForSale(selectedItem.id, priceInWei).estimateGas({ from: account });

        await contract.methods.listForSale(selectedItem.id, priceInWei).send({ 
          from: account, 
          gas: Math.floor(Number(listGasEstimate) * 1.1),
          nonce: await web3.eth.getTransactionCount(account)
        });

        alert(`Successfully listed ${selectedItem.name} for ${sellPrice} ETH`);
      }

      // Increment nonce

      closeSellDialog();
      
      // Refresh the collection
      const updatedCollection = collection.map(item => 
        item.id === selectedItem.id 
          ? { ...item, isListed: !item.isListed, price: selectedItem.isListed ? undefined : sellPrice }
          : item
      );
      console.log("zzz")
      setCollection(updatedCollection);
    } catch (error) {
      console.error("Failed to list/unlist item:", error);
      if (error instanceof Error) {
        alert(`Failed to list/unlist item: ${error.message}`);
      } else {
        alert("Failed to list/unlist item. Please try again.");
      }
    }
  };

  if (loading) {
    return <div className="text-white">Loading your collection...</div>;
  }

  return (
    <div className="mt-12">
      <h2 className="text-white text-xl font-bold mb-4">Your Collection</h2>
      <div className="flex flex-wrap justify-center gap-4">
        {collection.length === 0 ? (
          <p className="text-white">No items collected yet.</p>
        ) : (
          collection.map((item) => (
            <div key={item.id} className="relative group">
              <GachaCard 
                item={item} 
                isListed={item.isListed} 
                price={item.price}
              />
              <button
                onClick={() => openSellDialog(item)}
                className="absolute bottom-4 right-4 bg-yellow-400 text-black px-2 py-1 rounded hover:bg-yellow-500 transition duration-300 opacity-0 group-hover:opacity-100"
              >
                {item.isListed ? 'Unlist' : 'Sell'}
              </button>
            </div>
          ))
        )}
      </div>

      {showDialog && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-white mb-4">
              {selectedItem.isListed ? `Unlist ${selectedItem.name}` : `Sell ${selectedItem.name}`}
            </h3>
            {!selectedItem.isListed && (
              <input
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="Enter price in ETH"
                className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
                min="0"
                step="0.001"
              />
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={closeSellDialog}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition duration-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSellSubmit}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition duration-300"
              >
                {selectedItem.isListed ? 'Unlist' : 'List for Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Collection;
