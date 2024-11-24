import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import { characters } from '../new/src/data/characters.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const NETWORK_URL = process.env.NETWORK_URL || 'http://localhost:8545';
const FILEBASE_API_KEY = process.env.FILEBASE_API_KEY;
const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET;

const web3 = new Web3(new Web3.providers.HttpProvider(NETWORK_URL));
const contractJsonPath = path.join(__dirname, '../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json');
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
const gachaCollectible = new web3.eth.Contract(contractJson.abi, CONTRACT_ADDRESS);

async function uploadToFilebase(filePath, fileName) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), fileName);

    try {
        const response = await axios.post(`https://s3.filebase.com/${FILEBASE_BUCKET}`, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${FILEBASE_API_KEY}`,
            },
        });

        if (response.status === 200) {
            const location = response.headers['location'];
            const cid = location.split('/').pop();
            return cid;
        } else {
            throw new Error(`Failed to upload file: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error uploading to Filebase:', error);
        throw error;
    }
}

async function uploadMetadataToFilebase(metadata) {
    const fileName = `${metadata.name}_metadata.json`;
    const tempFilePath = path.join(__dirname, fileName);

    try {
        fs.writeFileSync(tempFilePath, JSON.stringify(metadata));
        const cid = await uploadToFilebase(tempFilePath, fileName);
        fs.unlinkSync(tempFilePath);
        return cid;
    } catch (error) {
        console.error('Error uploading metadata to Filebase:', error);
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        throw error;
    }
}

async function uploadToIPFS(character) {
    const imagePath = path.join(__dirname, '..', 'images', 'tcg', 'Character Cards', character.image);
    const imageHash = await uploadToFilebase(imagePath, character.image);

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

    const metadataHash = await uploadMetadataToFilebase(metadata);
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
