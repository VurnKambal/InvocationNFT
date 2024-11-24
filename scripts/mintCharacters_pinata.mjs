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

const web3 = new Web3(new Web3.providers.HttpProvider(NETWORK_URL));
const contractJsonPath = path.join(__dirname, '../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json');
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
const gachaCollectible = new web3.eth.Contract(contractJson.abi, CONTRACT_ADDRESS);

const pinata = new pinataSDK(PINATA_API_KEY, PINATA_SECRET_API_KEY);

async function unpinAllFromPinata() {
    try {
        const filter = { status: 'pinned' };
        const result = await pinata.pinList(filter);
        await Promise.all(result.rows.map(async (item) => {
            await pinata.unpin(item.ipfs_pin_hash);
            console.log(`Unpinned: ${item.ipfs_pin_hash}`);
        }));
        console.log('All existing pins have been removed.');
    } catch (error) {
        console.error('Error unpinning from Pinata:', error);
    }
}

async function uploadToPinata(filePath, name) {
    try {
        const readableStreamForFile = fs.createReadStream(filePath);
        const options = { pinataMetadata: { name: name } };
        const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
        return result.IpfsHash;
    } catch (error) {
        console.error('Error uploading to Pinata:', error);
        throw error;
    }
}

async function uploadMetadataToPinata(metadata) {
    try {
        const result = await pinata.pinJSONToIPFS(metadata, {
            pinataMetadata: { name: `${metadata.name}_metadata` }
        });
        return result.IpfsHash;
    } catch (error) {
        console.error('Error uploading metadata to Pinata:', error);
        throw error;
    }
}

async function uploadToIPFS(character) {
    const imagePath = path.join(__dirname, '..', 'images', 'tcg', 'Character Cards', character.image);
    const imageHash = await uploadToPinata(imagePath, character.name);

    const metadata = {
        name: character.name,
        description: `${character.name} - ${character.element} ${character.weapon} user from ${character.faction}`,
        image: `ipfs://${imageHash}`,
        attributes: [
            { trait_type: 'Rarity', value: character.rarity },
            { trait_type: 'Element', value: character.element },
            { trait_type: 'Weapon', value: character.weapon },
            { trait_type: 'Faction', value: character.faction }
        ]
    };

    const metadataHash = await uploadMetadataToPinata(metadata);
    return `ipfs://${metadataHash}`;
}

async function processCharacter(character) {
    try {
        console.log(`Processing ${character.name}...`);
        const tokenURI = await uploadToIPFS(character);
        console.log(`Metadata uploaded to IPFS: ${tokenURI}`);
        return { character, tokenURI };
    } catch (error) {
        console.error(`Error processing ${character.name}:`, error);
        return null;
    }
}

async function mintCharacter(character, tokenURI) {
    try {
        const availableTokens = await gachaCollectible.methods.getAvailableTokensCount().call();
        const maxSupply = await gachaCollectible.methods.MAX_SUPPLY().call();

        if (parseInt(availableTokens) < parseInt(maxSupply)) {
            const mintCharacterMethod = gachaCollectible.methods.mintCharacter(
                tokenURI,
                character.rarity - 1 // Adjust rarity to match contract enum (0-indexed)
            );

            const gas = await mintCharacterMethod.estimateGas({ from: OWNER_ADDRESS });
            const gasPrice = await web3.eth.getGasPrice();

            const tx = await mintCharacterMethod.send({
                from: OWNER_ADDRESS,
                gas: gas,
                gasPrice: gasPrice
            });

            console.log(`Minted ${character.name}. Transaction hash: ${tx.transactionHash}`);
            return true;
        } else {
            console.log(`Max supply reached. Skipping ${character.name}.`);
            return false;
        }
    } catch (error) {
        console.error(`Error minting ${character.name}:`, error);
        if (error.receipt) {
            console.error("Transaction receipt:", error.receipt);
        }
        return false;
    }
}

async function main() {
    console.log('Unpinning all existing files from Pinata...');
    await unpinAllFromPinata();

    console.log('Starting to process characters...');

    const batchSize = 5; // Adjust this number based on your needs and rate limits
    for (let i = 0; i < characters.length; i += batchSize) {
        const batch = characters.slice(i, i + batchSize);
        const processedBatch = await Promise.all(batch.map(processCharacter));
        const validResults = processedBatch.filter(result => result !== null);

        for (const result of validResults) {
            const success = await mintCharacter(result.character, result.tokenURI);
            if (!success) break; // Stop if max supply is reached or there's an error
        }
    }

    console.log('All characters processed!');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
