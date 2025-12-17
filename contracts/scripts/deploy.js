const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Arc Agent contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Configuration - Update these for your deployment
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x0000000000000000000000000000000000000000";
  const FEE_COLLECTOR = process.env.FEE_COLLECTOR || deployer.address;

  console.log("\nConfiguration:");
  console.log("  USDC Address:", USDC_ADDRESS);
  console.log("  Fee Collector:", FEE_COLLECTOR);

  // Deploy Identity Registry
  console.log("\n1. Deploying ArcAgentIdentity...");
  const ArcAgentIdentity = await hre.ethers.getContractFactory("ArcAgentIdentity");
  const identity = await ArcAgentIdentity.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log("   ArcAgentIdentity deployed to:", identityAddr);

  // Deploy Reputation Registry
  console.log("\n2. Deploying ArcAgentReputation...");
  const ArcAgentReputation = await hre.ethers.getContractFactory("ArcAgentReputation");
  const reputation = await ArcAgentReputation.deploy(identityAddr);
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log("   ArcAgentReputation deployed to:", reputationAddr);

  // Deploy Proof Attestation Registry
  console.log("\n3. Deploying ArcProofAttestation...");
  const ArcProofAttestation = await hre.ethers.getContractFactory("ArcProofAttestation");
  const proofAttestation = await ArcProofAttestation.deploy(identityAddr);
  await proofAttestation.waitForDeployment();
  const proofAttestationAddr = await proofAttestation.getAddress();
  console.log("   ArcProofAttestation deployed to:", proofAttestationAddr);

  // Deploy Treasury (with placeholder oracle)
  console.log("\n4. Deploying ArcTreasury...");
  const ArcTreasury = await hre.ethers.getContractFactory("ArcTreasury");
  const treasury = await ArcTreasury.deploy(
    USDC_ADDRESS,
    identityAddr,
    proofAttestationAddr,
    "0x0000000000000000000000000000000000000000", // Oracle set later
    FEE_COLLECTOR
  );
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();
  console.log("   ArcTreasury deployed to:", treasuryAddr);

  // Deploy Compliance Oracle
  console.log("\n5. Deploying ArcComplianceOracle...");
  const ArcComplianceOracle = await hre.ethers.getContractFactory("ArcComplianceOracle");
  const complianceOracle = await ArcComplianceOracle.deploy(treasuryAddr);
  await complianceOracle.waitForDeployment();
  const complianceOracleAddr = await complianceOracle.getAddress();
  console.log("   ArcComplianceOracle deployed to:", complianceOracleAddr);

  // Wire up: Set oracle in treasury
  console.log("\n6. Configuring contracts...");
  console.log("   Setting compliance oracle in Treasury...");
  await treasury.setComplianceOracle(complianceOracleAddr);

  // Wire up: Set compliance oracle in identity for KYC updates
  console.log("   Setting compliance oracle in Identity...");
  await identity.setComplianceOracle(complianceOracleAddr);

  // Deploy main ArcAgent facade
  console.log("\n7. Deploying ArcAgent facade...");
  const ArcAgent = await hre.ethers.getContractFactory("ArcAgent");
  const arcAgent = await ArcAgent.deploy(identityAddr, reputationAddr, proofAttestationAddr);
  await arcAgent.waitForDeployment();
  const arcAgentAddr = await arcAgent.getAddress();
  console.log("   ArcAgent deployed to:", arcAgentAddr);

  // Wire up: Set treasury in ArcAgent
  console.log("   Setting treasury in ArcAgent...");
  await arcAgent.setTreasury(treasuryAddr);

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(70));
  console.log(`
Contract Addresses:
-------------------
ArcAgentIdentity:     ${identityAddr}
ArcAgentReputation:   ${reputationAddr}
ArcProofAttestation:  ${proofAttestationAddr}
ArcTreasury:          ${treasuryAddr}
ArcComplianceOracle:  ${complianceOracleAddr}
ArcAgent (facade):    ${arcAgentAddr}

Network: ${hre.network.name}
Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}

Add to your .env:
-----------------
ARC_IDENTITY_ADDRESS=${identityAddr}
ARC_REPUTATION_ADDRESS=${reputationAddr}
ARC_PROOF_ATTESTATION_ADDRESS=${proofAttestationAddr}
ARC_TREASURY_ADDRESS=${treasuryAddr}
ARC_COMPLIANCE_ORACLE_ADDRESS=${complianceOracleAddr}
ARC_AGENT_ADDRESS=${arcAgentAddr}

Configuration:
--------------
USDC_ADDRESS=${USDC_ADDRESS}
FEE_COLLECTOR=${FEE_COLLECTOR}
`);

  // Verify contracts if on testnet/mainnet
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\nWaiting for block confirmations before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s

    console.log("\nVerifying contracts on explorer...");
    try {
      await hre.run("verify:verify", {
        address: identityAddr,
        constructorArguments: []
      });
      await hre.run("verify:verify", {
        address: reputationAddr,
        constructorArguments: [identityAddr]
      });
      await hre.run("verify:verify", {
        address: proofAttestationAddr,
        constructorArguments: [identityAddr]
      });
      await hre.run("verify:verify", {
        address: treasuryAddr,
        constructorArguments: [
          USDC_ADDRESS,
          identityAddr,
          proofAttestationAddr,
          "0x0000000000000000000000000000000000000000",
          FEE_COLLECTOR
        ]
      });
      await hre.run("verify:verify", {
        address: complianceOracleAddr,
        constructorArguments: [treasuryAddr]
      });
      await hre.run("verify:verify", {
        address: arcAgentAddr,
        constructorArguments: [identityAddr, reputationAddr, proofAttestationAddr]
      });
      console.log("All contracts verified!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
