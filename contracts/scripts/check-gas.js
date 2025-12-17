const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;

  // Get gas price
  const feeData = await provider.getFeeData();
  console.log("Gas Price Info:");
  console.log("  gasPrice:", feeData.gasPrice?.toString(), "wei");
  console.log("  gasPrice:", hre.ethers.formatUnits(feeData.gasPrice || 0, "gwei"), "gwei");
  console.log("  maxFeePerGas:", feeData.maxFeePerGas?.toString());
  console.log("  maxPriorityFeePerGas:", feeData.maxPriorityFeePerGas?.toString());

  // Get block info
  const block = await provider.getBlock("latest");
  console.log("\nLatest Block:");
  console.log("  number:", block.number);
  console.log("  baseFeePerGas:", block.baseFeePerGas?.toString(), "wei");
  if (block.baseFeePerGas) {
    console.log("  baseFeePerGas:", hre.ethers.formatUnits(block.baseFeePerGas, "gwei"), "gwei");
  }

  // Estimate deployment gas for each contract
  console.log("\nEstimated Deployment Gas:");

  const contracts = [
    "ArcAgentIdentity",
    "ArcAgentReputation",
    "ArcProofAttestation",
    "ArcTreasury",
    "ArcComplianceOracle",
    "ArcAgent"
  ];

  let totalGas = 0n;

  for (const name of contracts) {
    try {
      const factory = await hre.ethers.getContractFactory(name);
      const deployTx = await factory.getDeployTransaction(
        // Constructor args - use dummy values for estimation
        ...(name === "ArcAgentReputation" ? ["0x0000000000000000000000000000000000000001"] :
            name === "ArcProofAttestation" ? ["0x0000000000000000000000000000000000000001"] :
            name === "ArcTreasury" ? [
              "0x0000000000000000000000000000000000000001",
              "0x0000000000000000000000000000000000000001",
              "0x0000000000000000000000000000000000000001",
              "0x0000000000000000000000000000000000000000",
              "0x0000000000000000000000000000000000000001"
            ] :
            name === "ArcComplianceOracle" ? ["0x0000000000000000000000000000000000000001"] :
            name === "ArcAgent" ? [
              "0x0000000000000000000000000000000000000001",
              "0x0000000000000000000000000000000000000001",
              "0x0000000000000000000000000000000000000001"
            ] : [])
      );

      const estimated = await provider.estimateGas(deployTx);
      const bytecodeSize = (deployTx.data?.length || 0) / 2;
      totalGas += estimated;

      const costWei = estimated * (feeData.gasPrice || 0n);
      const costNative = hre.ethers.formatEther(costWei);

      console.log(`  ${name}:`);
      console.log(`    gas: ${estimated.toLocaleString()}`);
      console.log(`    bytecode: ${bytecodeSize.toLocaleString()} bytes`);
      console.log(`    cost: ${costNative} native tokens`);
    } catch (e) {
      console.log(`  ${name}: error - ${e.message}`);
    }
  }

  const totalCostWei = totalGas * (feeData.gasPrice || 0n);
  console.log("\nTotal estimated:");
  console.log(`  gas: ${totalGas.toLocaleString()}`);
  console.log(`  cost: ${hre.ethers.formatEther(totalCostWei)} native tokens`);
}

main().catch(console.error);
