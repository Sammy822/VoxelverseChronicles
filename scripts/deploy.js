const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);
  console.log(`Account balance: ${(await ethers.provider.getBalance(deployer.address)).toString()}`);

  // --- Deploy ItemWeapon Contract ---
  // The string "ItemWeapon" MUST match the contract name and the file name (ItemWeapon.sol) exactly.
  // The error HH702 is caused by a mismatch here or in another script/test file.
  // For example: ethers.getContractFactory("Itemweapon") <-- with lowercase 'w' will fail.
  console.log("\nDeploying ItemWeapon...");
  const ItemWeaponFactory = await ethers.getContractFactory("ItemWeapon");
  const itemWeapon = await ItemWeaponFactory.deploy();
  await itemWeapon.waitForDeployment();
  const itemWeaponAddress = await itemWeapon.getAddress();
  console.log(`ItemWeapon contract deployed at: ${itemWeaponAddress}`);

  // --- Deploy Lock Contract ---
  console.log("\nDeploying Lock...");
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const unlockTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECS;
  const lockedAmount = ethers.parseEther("0.001");

  const LockFactory = await ethers.getContractFactory("Lock");
  const lock = await LockFactory.deploy(unlockTime, { value: lockedAmount });
  await lock.waitForDeployment();
  const lockAddress = await lock.getAddress();
  console.log(`Lock contract with 0.001 ETH deployed at: ${lockAddress}, unlockable at timestamp ${unlockTime}`);

  console.log("\n--- Deployment Summary ---");
  console.log(`ItemWeapon Address: ${itemWeaponAddress}`);
  console.log(`Lock Address: ${lockAddress}`);
  console.log("--------------------------");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exitCode = 1;
});
