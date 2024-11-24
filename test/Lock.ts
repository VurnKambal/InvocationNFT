import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { web3 } from 'hardhat';
import artifacts from '../artifacts/contracts/Lock.sol/Lock.json';

describe('Lock', function () {
	async function deployOneYearLockFixture() {
		const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
		const ONE_GWEI = 1_000_000_000;

		const lockedAmount = ONE_GWEI;
		const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

		const lockContract = new web3.eth.Contract(artifacts.abi);
		lockContract.handleRevert = true;

		const [deployer, otherAccount] = await web3.eth.getAccounts();
		const rawContract = lockContract.deploy({
			data: artifacts.bytecode,
			arguments: [unlockTime],
		});

		// To know how much gas will be consumed, we can estimate it first.
		const estimateGas = await rawContract.estimateGas({
			from: deployer,
			value: lockedAmount.toString(),
		});

		const lock = await rawContract.send({
			from: deployer,
			gas: estimateGas.toString(),
			gasPrice: '10000000000',
			value: lockedAmount.toString(),
		});

		console.log('Lock contract deployed to: ', lock.options.address);
		return { lock, unlockTime, lockedAmount, deployer, otherAccount, rawContract };
	}

	describe('Deployment', function () {
		it('Should set the right unlockTime', async function () {
			const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);
			const setTime = await lock.methods.unlockTime().call();
			console.log('SetTime', setTime);
			expect(setTime).to.equal(unlockTime);
		});

		it('Should set the right deployer', async function () {
			const { lock, deployer } = await loadFixture(deployOneYearLockFixture);

			expect(await lock.methods.owner().call()).to.equal(deployer);
		});

		it('Should receive and store the funds to lock', async function () {
			const { lock, lockedAmount } = await loadFixture(deployOneYearLockFixture);
			const balance = await web3.eth.getBalance(String(lock.options.address));
			expect(balance).to.equal(lockedAmount);
		});

		it("Shouldn't fail if the unlockTime has arrived and the deployer calls it", async function () {
			const { lock, unlockTime, deployer } = await loadFixture(deployOneYearLockFixture);

			await time.increaseTo(unlockTime);
			await expect(lock.methods.withdraw().send({ from: deployer })).not.to.be.reverted;
		});
	});
});