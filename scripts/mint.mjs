import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

async function mintCard(asset, tokenURI) {
    try {
        const availableTokens = await gachaCollectible.methods.getAvailableTokensCount().call();
        const maxSupply = await gachaCollectible.methods.MAX_SUPPLY().call();

        if (parseInt(availableTokens) < parseInt(maxSupply)) {
            const mintCardMethod = gachaCollectible.methods.mintCard(
                tokenURI,
                asset.rarity - 1 // Adjust rarity to match contract enum (0-indexed)
            );

            const gas = await mintCardMethod.estimateGas({ from: OWNER_ADDRESS });
            const gasPrice = await web3.eth.getGasPrice();

            const tx = await mintCardMethod.send({
                from: OWNER_ADDRESS,
                gas: gas,
                gasPrice: gasPrice
            });

            console.log(`Minted ${asset.name}. Transaction hash: ${tx.transactionHash}`);
            return true;
        } else {
            console.log(`Max supply reached. Skipping ${asset.name}.`);
            return false;
        }
    } catch (error) {
        console.error(`Error minting ${asset.name}:`, error);
        if (error.receipt) {
            console.error("Transaction receipt:", error.receipt);
        }
        return false;
    }
}

async function main() {
    console.log('Starting to mint cards...');

    // Load the asset data from the JSON file
    const assetDataPath = path.join(__dirname, 'asset_ipfs_data.json');
    const assetData = JSON.parse(fs.readFileSync(assetDataPath, 'utf8'));

    const batchSize = 5; // Adjust this number based on your needs and rate limits
    for (let i = 0; i < assetData.length; i += batchSize) {
        const batch = assetData.slice(i, i + batchSize);
        for (const result of batch) {
            const success = await mintCard(result.asset, result.tokenURI);
            if (!success) {
                console.log('Stopping minting process due to an error or max supply reached.');
                return;
            }
        }
    }

    console.log('All cards minted!');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
