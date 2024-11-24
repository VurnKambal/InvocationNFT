import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { create } from 'ipfs-http-client';
import { characters } from '../new/src/data/characters.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const NETWORK_URL = process.env.NETWORK_URL || 'http://localhost:8545';

const web3 = new Web3(new Web3.providers.HttpProvider(NETWORK_URL));
const contractJsonPath = path.join(__dirname, '../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json');
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
const gachaCollectible = new web3.eth.Contract(contractJson.abi, CONTRACT_ADDRESS);

const ipfs = create({ url: 'http://localhost:5001' });

async function uploadToIPFS(character) {
    const imagePath = path.join(__dirname, '..', 'images', 'tcg', 'Character Cards', character.image);
    const imageBuffer = fs.readFileSync(imagePath);
    const imageFile = await ipfs.add(imageBuffer);

    const metadata = {
        name: character.name,
        description: `${character.name} - ${character.element} ${character.weapon} user from ${character.faction}`,
        local_image: `http://127.0.0.1:8081/${imageFile.cid}`,
        image: `ipfs://${imageFile.cid}`,
        attributes: [
            { trait_type: 'Rarity', value: character.rarity },
            { trait_type: 'Element', value: character.element },
            { trait_type: 'Weapon', value: character.weapon },
            { trait_type: 'Faction', value: character.faction }
        ]
    };

    const metadataFile = await ipfs.add(JSON.stringify(metadata));
    return `ipfs://${metadataFile.cid}`;
}

async function main() {
    console.log('Starting to mint characters...');

    for (const character of characters) {
        try {
            console.log(`Processing ${character.name}...`);

            const tokenURI = await uploadToIPFS(character);
            console.log(`Metadata uploaded to IPFS: ${tokenURI}`);

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
                    gas: gas, // Increase gas limit by 20%
                    gasPrice: gasPrice
                });

                console.log(`Minted ${character.name}. Transaction hash: ${tx.transactionHash}`);
            } else {
                console.log(`Max supply reached. Skipping ${character.name}.`);
                break;
            }
        } catch (error) {
            console.error(`Error processing ${character.name}:`, error);

            if (error.receipt) {
                console.error("Transaction receipt:", error.receipt);
            }
        }
    }

    console.log('All characters processed!');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
