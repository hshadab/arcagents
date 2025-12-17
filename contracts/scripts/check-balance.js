const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance (wei):", balance.toString());
  console.log("Balance (ETH/native):", hre.ethers.formatEther(balance));

  // Check network
  const network = await hre.ethers.provider.getNetwork();
  console.log("Network:", network.name, "ChainId:", network.chainId.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
