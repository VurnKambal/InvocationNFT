declare module '@pinata/sdk' {
    export default class PinataSDK {
      constructor(apiKey: string, apiSecret: string);
      pinFileToIPFS(file: Uint8Array | string, options?: any): Promise<{ IpfsHash: string }>;
      pinJSONToIPFS(json: any, options?: any): Promise<{ IpfsHash: string }>;
    }
  }
  
  