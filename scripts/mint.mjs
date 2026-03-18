import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import GachaCollectibleABI from './GachaCollectibleABI.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK_URL = process.env.NETWORK_URL || 'http://localhost:8545';
const PRIORITY_FEE_GWEI = process.env.PRIORITY_FEE_GWEI || '2';
const MAX_FEE_MULTIPLIER = Number(process.env.MAX_FEE_MULTIPLIER || '2');

const web3 = new Web3(new Web3.providers.HttpProvider(NETWORK_URL));
const gachaCollectible = new web3.eth.Contract(GachaCollectibleABI, CONTRACT_ADDRESS);

function normalizePrivateKey(privateKey) {
    if (!privateKey) return null;
    return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
}

async function setupSigner() {
    const normalizedPrivateKey = normalizePrivateKey(PRIVATE_KEY);
    if (!normalizedPrivateKey) {
        throw new Error('Missing PRIVATE_KEY in environment variables.');
    }

    const accountFromPk = web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey);
    web3.eth.accounts.wallet.add(accountFromPk);

    if (OWNER_ADDRESS && OWNER_ADDRESS.toLowerCase() !== accountFromPk.address.toLowerCase()) {
        throw new Error(`OWNER_ADDRESS (${OWNER_ADDRESS}) does not match PRIVATE_KEY address (${accountFromPk.address}).`);
    }

    return accountFromPk.address;
}

async function getFeeOverrides() {
    const priorityFee = web3.utils.toWei(PRIORITY_FEE_GWEI, 'gwei');
    const pendingBlock = await web3.eth.getBlock('pending');
    const baseFee = pendingBlock.baseFeePerGas;

    if (baseFee !== undefined && baseFee !== null) {
        const maxFeePerGas = (BigInt(baseFee.toString()) * BigInt(MAX_FEE_MULTIPLIER)) + BigInt(priorityFee.toString());
        return {
            maxPriorityFeePerGas: priorityFee,
            maxFeePerGas: maxFeePerGas.toString()
        };
    }

    const gasPrice = await web3.eth.getGasPrice();
    return { gasPrice };
}

async function mintCard(asset, tokenURI, sender, mintFee) {
    try {
        const mintCardMethod = gachaCollectible.methods.mintCard(
            tokenURI,
            asset.rarity - 1 // Adjust rarity to match contract enum (0-indexed)
        );

        const feeOverrides = await getFeeOverrides();
        const gasEstimate = await mintCardMethod.estimateGas({ from: sender, value: mintFee });
        const gasLimit = BigInt(gasEstimate.toString()) * 120n / 100n;

        const tx = await mintCardMethod.send({
            from: sender,
            value: mintFee,
            gas: gasLimit.toString(),
            ...feeOverrides
        });

        console.log(`Minted ${asset.name}. Transaction hash: ${tx.transactionHash}`);
        return true;
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
    const sender = await setupSigner();

    // Load the asset data from the JSON file
    const assetDataPath = path.join(__dirname, 'asset_ipfs_data.json');
    const assetData = JSON.parse(fs.readFileSync(assetDataPath, 'utf8'));
    const currentSupply = Number(await gachaCollectible.methods.getAvailableTokensCount().call());
    const maxSupply = Number(await gachaCollectible.methods.MAX_SUPPLY().call());
    const mintFee = await gachaCollectible.methods.MINT_FEE().call();
    const capacityLeft = maxSupply - currentSupply;

    if (capacityLeft <= 0) {
        console.log('Max supply reached. No minting performed.');
        return;
    }

    if (assetData.length > capacityLeft) {
        console.log(`Only ${capacityLeft} mints available before max supply. Limiting batch.`);
    }

    const assetsToMint = assetData.slice(0, capacityLeft);

    const batchSize = 5; // Adjust this number based on your needs and rate limits
    for (let i = 0; i < assetsToMint.length; i += batchSize) {
        const batch = assetsToMint.slice(i, i + batchSize);
        for (const result of batch) {
            const success = await mintCard(result.asset, result.tokenURI, sender, mintFee);
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
