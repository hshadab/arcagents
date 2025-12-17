// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArcAgentIdentity.sol";
import "./ArcAgentReputation.sol";
import "./ArcProofAttestation.sol";
import "./ArcAgent.sol";
import "./ArcTreasury.sol";
import "./ArcComplianceOracle.sol";

/**
 * @title ArcAgentDeployer
 * @notice Factory for deploying the full Arc Agent ERC-8004 stack with Treasury and Compliance
 *
 * Deployment Order:
 * 1. ArcAgentIdentity (standalone)
 * 2. ArcAgentReputation (needs identity)
 * 3. ArcProofAttestation (needs identity)
 * 4. ArcTreasury (needs identity, proofAttestation, USDC address)
 * 5. ArcComplianceOracle (needs treasury)
 * 6. ArcAgent facade (needs identity, reputation, proofAttestation)
 * 7. Wire up: Treasury gets oracle, ArcAgent gets treasury, Identity gets oracle
 */
contract ArcAgentDeployer {

    event Deployed(
        address identity,
        address reputation,
        address proofAttestation,
        address arcAgent,
        address treasury,
        address complianceOracle
    );

    struct Deployment {
        ArcAgentIdentity identity;
        ArcAgentReputation reputation;
        ArcProofAttestation proofAttestation;
        ArcAgent arcAgent;
        ArcTreasury treasury;
        ArcComplianceOracle complianceOracle;
    }

    /**
     * @notice Deploy all Arc Agent contracts including Treasury and Compliance
     * @param usdcAddress Address of USDC token contract on this chain
     * @param feeCollector Address to receive transfer fees (can be address(0))
     * @return d Struct containing all deployed contract addresses
     */
    function deploy(
        address usdcAddress,
        address feeCollector
    ) external returns (Deployment memory d) {
        // 1. Deploy Identity Registry
        d.identity = new ArcAgentIdentity();

        // 2. Deploy Reputation Registry (needs identity reference)
        d.reputation = new ArcAgentReputation(address(d.identity));

        // 3. Deploy Proof Attestation Registry (needs identity reference)
        d.proofAttestation = new ArcProofAttestation(address(d.identity));

        // 4. Deploy Treasury (with placeholder oracle - will be set below)
        d.treasury = new ArcTreasury(
            usdcAddress,
            address(d.identity),
            address(d.proofAttestation),
            address(0), // Oracle will be set after deployment
            feeCollector
        );

        // 5. Deploy Compliance Oracle
        d.complianceOracle = new ArcComplianceOracle(address(d.treasury));

        // 6. Wire up: Set oracle in treasury
        d.treasury.setComplianceOracle(address(d.complianceOracle));

        // 7. Wire up: Set compliance oracle in identity for KYC updates
        d.identity.setComplianceOracle(address(d.complianceOracle));

        // 8. Deploy main ArcAgent facade
        d.arcAgent = new ArcAgent(
            address(d.identity),
            address(d.reputation),
            address(d.proofAttestation)
        );

        // 9. Wire up: Set treasury in ArcAgent
        d.arcAgent.setTreasury(address(d.treasury));

        // 10. Transfer ownership of all contracts to deployer (msg.sender)
        d.identity.transferOwnership(msg.sender);
        d.proofAttestation.transferOwnership(msg.sender);
        d.treasury.transferOwnership(msg.sender);
        d.complianceOracle.transferOwnership(msg.sender);
        d.arcAgent.transferOwnership(msg.sender);

        emit Deployed(
            address(d.identity),
            address(d.reputation),
            address(d.proofAttestation),
            address(d.arcAgent),
            address(d.treasury),
            address(d.complianceOracle)
        );
    }

    /**
     * @notice Deploy core contracts only (without Treasury)
     * @dev Use this for deployments where Treasury is not needed or will be added later
     */
    function deployCore() external returns (
        ArcAgentIdentity identity,
        ArcAgentReputation reputation,
        ArcProofAttestation proofAttestation,
        ArcAgent arcAgent
    ) {
        identity = new ArcAgentIdentity();
        reputation = new ArcAgentReputation(address(identity));
        proofAttestation = new ArcProofAttestation(address(identity));
        arcAgent = new ArcAgent(
            address(identity),
            address(reputation),
            address(proofAttestation)
        );

        // Transfer ownership
        identity.transferOwnership(msg.sender);
        proofAttestation.transferOwnership(msg.sender);
        arcAgent.transferOwnership(msg.sender);
    }
}
