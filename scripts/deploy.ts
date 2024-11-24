import { web3, network } from 'hardhat';
import { AbiItem } from 'web3-utils';
import GachaCollectibleArtifact from '../artifacts/contracts/GachaCollectible.sol/GachaCollectible.json';

async function main() {
	if (network.name !== 'sepolia' && network.name !== 'localhost') {
		throw new Error('Please run the deployment script on the Sepolia network or localhost Hardhat network');
	}

	const [deployer] = await web3.eth.getAccounts();
	console.log("Deploying contracts with the account:", deployer);

	const balance = await web3.eth.getBalance(deployer);
	console.log("Account balance:", web3.utils.fromWei(balance, "ether"), "ETH");

	// Check for pending transactions
	const pendingNonce = await web3.eth.getTransactionCount(deployer, 'pending');
	const confirmedNonce = await web3.eth.getTransactionCount(deployer, 'latest');
	if (pendingNonce > confirmedNonce) {
		console.warn('There are pending transactions. You may want to wait for them to complete or replace them.');
	}

	const GachaCollectible = new web3.eth.Contract(GachaCollectibleArtifact.abi as AbiItem[]);
	console.log('Deploying GachaCollectible...');

	const gasPrice = network.name === 'localhost' ? '20000000000' : await web3.eth.getGasPrice();
	const increasedGasPrice = BigInt(gasPrice) * BigInt(120) / BigInt(100); // 20% increase

	const estimatedGas = await GachaCollectible.deploy({
		data: GachaCollectibleArtifact.bytecode,
		arguments: [deployer]
	}).estimateGas();

	const gachaCollectible = await GachaCollectible.deploy({
		data: GachaCollectibleArtifact.bytecode,
		arguments: [deployer]
	}).send({
		from: deployer,
		gas: Math.floor(Number(estimatedGas)), // Use estimated gas with a 20% buffer, capped at 3M
		gasPrice: network.name === 'localhost' ? undefined : gasPrice.toString(),
		nonce: pendingNonce, // Use the pending nonce to ensure we're not blocked by previous transactions
	});

	console.log("GachaCollectible deployed to:", gachaCollectible.options.address);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error('Deployment failed:', error);
		process.exitCode = 1;
	});
