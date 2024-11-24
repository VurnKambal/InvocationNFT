import pinataSDK from '@pinata/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();


const pinata = new pinataSDK({ pinataApiKey: process.env.PINATA_API_KEY, pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY });

async function uploadToIPFS() {
    // Dynamically import characters
    const { characters } = await import('../new/src/data/characters');

    // First, upload all images
    const imageUploadPromises = characters.map(async (character) => {
        const imagePath = path.join(__dirname, '../new/images', character.image);
        const readableStreamForFile = fs.createReadStream(imagePath);
        const options = {
            pinataMetadata: {
                name: character.name,
            },
        };
        const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
        return { ...character, ipfsImageHash: result.IpfsHash };
    });

    const charactersWithImageHashes = await Promise.all(imageUploadPromises);

    // Then, create and upload metadata for each character
    const metadataUploadPromises = charactersWithImageHashes.map(async (character) => {
        const metadata = {
            name: character.name,
            description: `A ${character.rarity}-star ${character.element} character from the DinoNFT Gacha game.`,
            image: `ipfs://${character.ipfsImageHash}`,
            attributes: [
                { trait_type: 'Rarity', value: character.rarity },
                { trait_type: 'Element', value: character.element },
                { trait_type: 'ID', value: character.id }
            ]
        };

        const options = {
            pinataMetadata: {
                name: `${character.name} Metadata`,
            },
        };

        const result = await pinata.pinJSONToIPFS(metadata, options);
        return { ...character, ipfsMetadataHash: result.IpfsHash };
    });

    const finalCharacterData = await Promise.all(metadataUploadPromises);

    // Write the final data to a file
    fs.writeFileSync(
        path.join(__dirname, '../characterIPFSData.json'),
        JSON.stringify(finalCharacterData, null, 2)
    );

    console.log('All character data uploaded to IPFS and saved to characterIPFSData.json');
    return finalCharacterData;
}

export { uploadToIPFS };
