import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pinataSDK from '@pinata/sdk';
import { characters } from '../new/src/data/characters.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const NETWORK_URL = process.env.NETWORK_URL || 'http://localhost:8545';
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

// Pinata setup
const pinata = new pinataSDK(PINATA_API_KEY, PINATA_SECRET_API_KEY);

async function uploadToPinata(character) {
    // First, upload the image
    const imagePath = path.join(__dirname, '../new/images', character.image);
    const readableStreamForFile = fs.createReadStream(imagePath);
    const imageResult = await pinata.pinFileToIPFS(readableStreamForFile, {
        pinataMetadata: { name: `${character.name}_image` }
    });

    // Then, create and upload metadata
    const metadata = {
        name: character.name,
        description: `A ${character.rarity}-star ${character.element} character from the DinoNFT Gacha game.`,
        image: `ipfs://${imageResult.IpfsHash}`,
        attributes: [
            { trait_type: 'Rarity', value: character.rarity },
            { trait_type: 'Element', value: character.element },
            { trait_type: 'ID', value: character.id }
        ]
    };

    const metadataResult = await pinata.pinJSONToIPFS(metadata, {
        pinataMetadata: { name: `${character.name}_metadata` }
    });

    return metadataResult.IpfsHash;
}

async function main() {
    const web3 = new Web3(new Web3.providers.HttpProvider(NETWORK_URL));

    // Read the ABI from the JSON file
    const contractJsonPath = path.join(__dirname, '../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json');
    const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));

    // Set up the contract instance
    const gachaCollectible = new web3.eth.Contract(contractJson.abi, CONTRACT_ADDRESS);

    for (const character of characters) {
        console.log(`Processing ${character.name}...`);
        
        // Upload character metadata to Pinata
        const metadataHash = await uploadToPinata(character);
        console.log(`Metadata uploaded to IPFS: ipfs://${metadataHash}`);

        // Mint the character
        const mintCharacterMethod = gachaCollectible.methods.mintCharacter(
            `ipfs://${metadataHash}`,
            character.rarity - 1 // Adjust rarity to match contract enum (0-indexed)
        );

        const gas = await mintCharacterMethod.estimateGas({ from: OWNER_ADDRESS });
        const gasPrice = await web3.eth.getGasPrice();

        const tx = await mintCharacterMethod.send({
            from: OWNER_ADDRESS,
            gas: gas.toString(),
            gasPrice: gasPrice.toString()
        });

        console.log(`Minted ${character.name} with tokenURI: ipfs://${metadataHash}`);
        console.log(`Transaction hash: ${tx.transactionHash}`);
    }

    console.log('All characters minted successfully!');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
