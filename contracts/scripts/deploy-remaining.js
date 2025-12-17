const hre = require("hardhat");
require("dotenv").config();

/**
 * Continuation deployment script for remaining Arc Agent contracts
 * Run this after funding the deployer wallet with more gas
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Continuing deployment with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Already deployed contracts (from previous deployment)
  const IDENTITY_ADDRESS = process.env.ARC_IDENTITY_ADDRESS;
  const REPUTATION_ADDRESS = process.env.ARC_REPUTATION_ADDRESS;
  const PROOF_ATTESTATION_ADDRESS = process.env.ARC_PROOF_ATTESTATION_ADDRESS;

  // Configuration
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x0000000000000000000000000000000000000000";
  const FEE_COLLECTOR = process.env.FEE_COLLECTOR || deployer.address;

  console.log("\nPreviously deployed:");
  console.log("  ArcAgentIdentity:", IDENTITY_ADDRESS);
  console.log("  ArcAgentReputation:", REPUTATION_ADDRESS);
  console.log("  ArcProofAttestation:", PROOF_ATTESTATION_ADDRESS);

  console.log("\nConfiguration:");
  console.log("  USDC Address:", USDC_ADDRESS);
  console.log("  Fee Collector:", FEE_COLLECTOR);

  // Get references to already deployed contracts
  const identity = await hre.ethers.getContractAt("ArcAgentIdentity", IDENTITY_ADDRESS);

  // Deploy Treasury (with placeholder oracle - will be set after ComplianceOracle deploys)
  console.log("\n4. Deploying ArcTreasury...");
  const ArcTreasury = await hre.ethers.getContractFactory("ArcTreasury");
  const treasury = await ArcTreasury.deploy(
    USDC_ADDRESS,
    IDENTITY_ADDRESS,
    PROOF_ATTESTATION_ADDRESS,
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
  const arcAgent = await ArcAgent.deploy(IDENTITY_ADDRESS, REPUTATION_ADDRESS, PROOF_ATTESTATION_ADDRESS);
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
ArcAgentIdentity:     ${IDENTITY_ADDRESS}
ArcAgentReputation:   ${REPUTATION_ADDRESS}
ArcProofAttestation:  ${PROOF_ATTESTATION_ADDRESS}
ArcTreasury:          ${treasuryAddr}
ArcComplianceOracle:  ${complianceOracleAddr}
ArcAgent (facade):    ${arcAgentAddr}

Network: ${hre.network.name}
Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}

Add to your .env:
-----------------
ARC_IDENTITY_ADDRESS=${IDENTITY_ADDRESS}
ARC_REPUTATION_ADDRESS=${REPUTATION_ADDRESS}
ARC_PROOF_ATTESTATION_ADDRESS=${PROOF_ATTESTATION_ADDRESS}
ARC_TREASURY_ADDRESS=${treasuryAddr}
ARC_COMPLIANCE_ORACLE_ADDRESS=${complianceOracleAddr}
ARC_AGENT_ADDRESS=${arcAgentAddr}

Configuration:
--------------
USDC_ADDRESS=${USDC_ADDRESS}
FEE_COLLECTOR=${FEE_COLLECTOR}
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
