import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PinataSDK } from 'pinata-web3';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.GATEWAY_URL!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const contentType = req.headers['content-type'] ?? '';

  // JSON metadata upload
  if (contentType.includes('application/json')) {
    const buffers: Buffer[] = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = JSON.parse(Buffer.concat(buffers).toString());
    const upload = await pinata.upload.json(body.metadata);
    return res.json({ IpfsHash: upload.IpfsHash });
  }

  // File (image) upload
  if (contentType.includes('multipart/form-data')) {
    const form = formidable({ keepExtensions: true });
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const blob = new Blob([fs.readFileSync(file.filepath)], {
      type: file.mimetype ?? 'application/octet-stream',
    });
    const namedFile = new File([blob], file.originalFilename ?? 'upload', {
      type: file.mimetype ?? 'application/octet-stream',
    });
    const upload = await pinata.upload.file(namedFile);
    return res.json({ IpfsHash: upload.IpfsHash });
  }

  return res.status(400).json({ error: 'Unsupported content type' });
}
