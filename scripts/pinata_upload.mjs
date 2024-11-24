import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pinataSDK from '@pinata/sdk';
import { characters } from '../new2/src/data/characters.js';
import { items } from '../new2/src/data/items.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

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

async function uploadToIPFS(asset) {
    const imagePath = path.join(__dirname, '..', 'new2', 'images', 'cards', asset.image);
    const imageHash = await uploadToPinata(imagePath, asset.name);

    const metadata = {
        name: asset.name,
        description: `${asset.name} - ${asset.category} from ${asset.faction || 'Unknown'}`,
        image: `ipfs://${imageHash}`,
        attributes: [
            { trait_type: 'Rarity', value: asset.rarity },
            { trait_type: 'Category', value: asset.category },
            ...(asset.element ? [{ trait_type: 'Element', value: asset.element }] : []),
            ...(asset.weapon ? [{ trait_type: 'Weapon', value: asset.weapon }] : []),
            ...(asset.faction ? [{ trait_type: 'Faction', value: asset.faction }] : [])
        ]
    };

    const metadataHash = await uploadMetadataToPinata(metadata);
    return `ipfs://${metadataHash}`;
}

async function processAsset(asset) {
    try {
        console.log(`Processing ${asset.name}...`);
        const tokenURI = await uploadToIPFS(asset);
        console.log(`Metadata uploaded to IPFS: ${tokenURI}`);
        return { asset, tokenURI };
    } catch (error) {
        console.error(`Error processing ${asset.name}:`, error);
        return null;
    }
}

async function main() {
    console.log('Unpinning all existing files from Pinata...');
    await unpinAllFromPinata();

    console.log('Starting to process characters and items...');

    const batchSize = 3; // Adjust this number based on your needs and rate limits
    const allAssets = [...characters, ...items];
    const results = [];

    for (let i = 0; i < allAssets.length; i += batchSize) {
        const batch = allAssets.slice(i, i + batchSize);
        const processedBatch = await Promise.all(batch.map(processAsset));
        const validResults = processedBatch.filter(result => result !== null);
        results.push(...validResults);
    }

    // Save results to a JSON file
    const outputPath = path.join(__dirname, 'asset_ipfs_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    console.log(`All characters and items processed!`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
