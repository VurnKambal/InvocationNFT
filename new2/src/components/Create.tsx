import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { abi as GachaCollectibleABI } from '../../../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json';
import { pinata } from '../utils/config';
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

interface CreateProps {
  account: string | null;
  web3: Web3 | null;
}

const Create: React.FC<CreateProps> = ({ account, web3 }) => {
  const [cardType, setCardType] = useState<'Character' | 'Item' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [rarity, setRarity] = useState(1);
  const [element, setElement] = useState('');
  const [weapon, setWeapon] = useState('');
  const [faction, setFaction] = useState('');
  const [category, setCategory] = useState('');
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (web3) {
      const contractInstance = new web3.eth.Contract(GachaCollectibleABI as AbiItem[], CONTRACT_ADDRESS);
      setContract(contractInstance);
    }
  }, [web3]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImage(event.target?.files?.[0] || null);
  };

  const uploadImageToPinata = async () => {
    if (!image) return;
    try {
      const upload = await pinata.upload.file(image);
      console.log(upload);
      const ipfsUrl = await pinata.gateways.convert(upload.IpfsHash);
      setImageUrl(ipfsUrl);
      return `ipfs://${upload.IpfsHash}`;
    } catch (error) {
      console.error('Error uploading image to Pinata:', error);
      throw error;
    }
  };

  const uploadMetadataToPinata = async (metadata: any) => {
    try {
      const upload = await pinata.upload.json(metadata);
      console.log(upload);
      return `ipfs://${upload.IpfsHash}`;
    } catch (error) {
      console.error('Error uploading metadata to Pinata:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !web3 || !contract || !image) return;

    setLoading(true);
    try {
      // Upload image to IPFS
      const imageIpfsUrl = await uploadImageToPinata();

      // Prepare metadata
      const metadata = {
        name,
        description,
        image: imageIpfsUrl,
        attributes: [
          { trait_type: 'Rarity', value: rarity },
          ...(cardType === 'Character' ? [
            { trait_type: 'Element', value: element },
            { trait_type: 'Weapon', value: weapon },
            { trait_type: 'Faction', value: faction },
          ] : [
            { trait_type: 'Category', value: category },
          ]),
        ],
      };

      // Upload metadata to IPFS
      const tokenURI = await uploadMetadataToPinata(metadata);

      // Mint NFT
      console.log(tokenURI);

      const availableTokens = await contract.methods.getAvailableTokensCount().call();
      const maxSupply = await contract.methods.MAX_SUPPLY().call();

      console.log(`Available tokens: ${availableTokens}, Max supply: ${maxSupply}`);

      if (parseInt(availableTokens) < parseInt(maxSupply)) {
        const mintCardMethod = contract.methods.mintCard(tokenURI, rarity - 1);
        
        // Check if the caller has minting permissions
        const owner = await contract.methods.owner().call();
        console.log(`Contract owner: ${owner}, Current account: ${account}`);

        // Try to estimate gas and log any errors
        try {
          const gas = await mintCardMethod.estimateGas({
            from: account,
            value: web3.utils.toWei('0.001', 'ether')
          });
          console.log(`Estimated gas: ${gas}`);
          const gasPrice = await web3.eth.getGasPrice();

          const tx = await mintCardMethod.send({
            from: account,
            value: web3.utils.toWei('0.001', 'ether'),
            gas: Math.floor(Number(gas) * 1.1),
            gasPrice: gasPrice,
            nonce: await web3.eth.getTransactionCount(account)
          });

          console.log(`Minted ${name}. Transaction hash: ${tx.transactionHash}`);
          alert(`NFT created successfully! Transaction hash: ${tx.transactionHash}`);
        } catch (estimateError) {
          console.error('Gas estimation failed:', estimateError);
          // if (estimateError.message.includes('execution reverted')) {
          //   const reason = await contract.methods.mintCard(tokenURI, rarity - 1).call({ from: account }).catch(e => e.message);
          //   console.error('Execution reverted reason:', reason);
          // }
          // alert('Failed to estimate gas. The transaction would likely fail. Please check your contract conditions.');
        }
      } else {
        console.log(`Max supply reached. Cannot mint ${name}.`);
        alert('Max supply reached. Cannot mint new NFT.');
      }
    } catch (error) {
      console.error('Error creating NFT:', error);
      if (error.receipt) {
        console.error("Transaction receipt:", error.receipt);
      }
      alert('Failed to create NFT. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto mt-8 p-4">
      <h2 className="text-2xl font-bold text-white mb-4">Create New NFT</h2>
      {!cardType ? (
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => setCardType('Character')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Create Character Card
          </button>
          <button
            onClick={() => setCardType('Item')}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
          >
            Create Item Card
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-white mb-2">Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 text-white"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-white mb-2">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 text-white"
              rows={4}
              required
            />
          </div>
          <div>
            <label htmlFor="image" className="block text-white mb-2">Image</label>
            <input
              type="file"
              id="image"
              onChange={handleImageChange}
              className="w-full p-2 rounded bg-gray-700 text-white"
              accept="image/*"
              required
            />
          </div>
          <div>
            <label htmlFor="rarity" className="block text-white mb-2">Rarity (1-5)</label>
            <input
              type="number"
              id="rarity"
              value={rarity}
              onChange={(e) => setRarity(Number(e.target.value))}
              className="w-full p-2 rounded bg-gray-700 text-white"
              min="1"
              max="5"
              required
            />
          </div>
          {cardType === 'Character' ? (
            <>
              <div>
                <label htmlFor="element" className="block text-white mb-2">Element</label>
                <select
                  id="element"
                  value={element}
                  onChange={(e) => setElement(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white"
                  required
                >
                  <option value="">Select an element</option>
                  <option value="Pyro">Pyro</option>
                  <option value="Hydro">Hydro</option>
                  <option value="Anemo">Anemo</option>
                  <option value="Electro">Electro</option>
                  <option value="Dendro">Dendro</option>
                  <option value="Cryo">Cryo</option>
                  <option value="Geo">Geo</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="weapon" className="block text-white mb-2">Weapon</label>
                <select
                  id="weapon"
                  value={weapon}
                  onChange={(e) => setWeapon(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white"
                  required
                >
                  <option value="">Select a weapon</option>
                  <option value="Sword">Sword</option>
                  <option value="Claymore">Claymore</option>
                  <option value="Polearm">Polearm</option>
                  <option value="Bow">Bow</option>
                  <option value="Catalyst">Catalyst</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="faction" className="block text-white mb-2">Faction</label>
                <input
                  type="text"
                  id="faction"
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="category" className="block text-white mb-2">Category</label>
              <input
                type="text"
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white"
                required
              />
            </div>
          )}
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create NFT'}
          </button>
        </form>
      )}
    </div>
  );
};

export default Create;
