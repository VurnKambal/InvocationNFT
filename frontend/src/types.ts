export interface Character {
  id: number;
  name: string;
  rarity: number;
  element: string;
  image: string; // Path to the image
  category: string;
  // artist: string;
  weapon?: string; // Optional weapon attribute
  faction?: string; // Optional faction attribute
  price?: number; // Price in ETH for marketplace
  forSale?: boolean; // Indicates if the character is listed for sale
  owner?: string; // Ethereum address of the current owner
}

export interface Item {
  id: number;
  name: string;
  rarity: number;
  image: string; // Path to the image
  category: string; // e.g., "Action", "Equipment"
  // artist:string;
  price?: number; // Price in ETH for marketplace
  forSale?: boolean; // Indicates if the item is listed for sale
  owner?: string; // Ethereum address of the current owner
}

export interface Attribute {
  trait_type: string;
  value: string | number;
}

export interface Metadata {
  name: string;
  description?: string;
  image: string;
  attributes: Attribute[];
}

export interface MarketplaceItem extends Character {
  tokenId: number; // The token ID of the NFT
  seller: string; // Ethereum address of the seller
  price: number; // Price in ETH
}

export interface MarketplaceTransaction {
  buyer: string;
  seller: string;
  tokenId: number;
  price: number;
  timestamp: number;
}
