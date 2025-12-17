// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArcAgentIdentity.sol";
import "./ArcAgentReputation.sol";
import "./ArcProofAttestation.sol";
import "./ArcTreasury.sol";
import "./ArcComplianceOracle.sol";
import "./IERC8004Identity.sol";

/**
 * @title ArcAgent
 * @notice Facade contract for creating and managing Arc Agents with ERC-8004 compliance
 * @dev Combines Identity, Reputation, Validation, and Treasury registries into unified interface
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                              ArcAgent                                        │
 * │  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
 * │  │  Identity   │ │  Reputation  │ │ ProofAttestation│ │    Treasury     │  │
 * │  │  Registry   │ │   Registry   │ │    Registry     │ │  (USDC Custody) │  │
 * │  │ (ERC-8004)  │ │  (ERC-8004)  │ │   (ERC-8004)    │ │   + Compliance  │  │
 * │  └─────────────┘ └──────────────┘ └─────────────────┘ └─────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
contract ArcAgent {

    ArcAgentIdentity public immutable identity;
    ArcAgentReputation public immutable reputation;
    ArcProofAttestation public immutable proofAttestation;
    ArcTreasury public treasury; // Mutable - can be set after deployment
    ArcComplianceOracle public complianceOracle; // For screening agent creators

    address public owner;

    // Compliance screening for agent creators
    bool public registrationScreeningEnabled = true;
    mapping(address => bool) private _approvedCreators; // Cache of approved addresses

    // KYC status enum
    uint8 public constant KYC_NONE = 0;
    uint8 public constant KYC_PENDING = 1;
    uint8 public constant KYC_APPROVED = 2;
    uint8 public constant KYC_REJECTED = 3;

    // Common reputation tags
    bytes32 public constant TAG_COMPLIANCE = keccak256("compliance");
    bytes32 public constant TAG_PAYMENT = keccak256("payment");
    bytes32 public constant TAG_ZKML = keccak256("zkml");
    bytes32 public constant TAG_LATENCY = keccak256("latency");
    bytes32 public constant TAG_ACCURACY = keccak256("accuracy");

    // Proof type tags
    bytes32 public constant PROOF_AUTHORIZATION = keccak256("authorization");
    bytes32 public constant PROOF_COMPLIANCE = keccak256("compliance_check");
    bytes32 public constant PROOF_COLLISION = keccak256("collision_severity");

    event AgentCreated(
        uint256 indexed agentId,
        address indexed owner,
        string circleWalletId,
        address circleWalletAddr
    );
    event ProofSubmitted(
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        bytes32 proofType
    );
    event TreasurySet(address indexed treasury);
    event ComplianceOracleSet(address indexed oracle);
    event CreatorApproved(address indexed creator);
    event CreatorBlocked(address indexed creator);
    event RegistrationScreeningToggled(bool enabled);
    event TransferInitiated(
        uint256 indexed agentId,
        uint256 indexed transferRequestId,
        bytes32 indexed proofHash
    );

    error NotOwner();
    error TreasuryAlreadySet();
    error TreasuryNotSet();
    error ZeroAddress();
    error CreatorNotCompliant(address creator);
    error ComplianceOracleNotSet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @dev Checks if creator is compliant before allowing agent registration
     * Compliance is checked via Circle Compliance Engine (screens for sanctions, etc.)
     */
    modifier onlyCompliantCreator() {
        if (registrationScreeningEnabled) {
            // Check cache first
            if (!_approvedCreators[msg.sender]) {
                // If not cached, check with treasury's compliance records
                if (address(treasury) != address(0)) {
                    IArcTreasury.ComplianceStatus status = treasury.getComplianceStatus(msg.sender);
                    if (status == IArcTreasury.ComplianceStatus.BLOCKED) {
                        revert CreatorNotCompliant(msg.sender);
                    }
                    if (status == IArcTreasury.ComplianceStatus.APPROVED) {
                        _approvedCreators[msg.sender] = true;
                    }
                }
                // Note: If no treasury or status is NONE/PENDING, we allow registration
                // The compliance check can be done asynchronously
            }
        }
        _;
    }

    constructor(
        address _identity,
        address _reputation,
        address _proofAttestation
    ) {
        identity = ArcAgentIdentity(_identity);
        reputation = ArcAgentReputation(_reputation);
        proofAttestation = ArcProofAttestation(_proofAttestation);
        owner = msg.sender;
    }

    // ============ Treasury Setup ============

    /**
     * @notice Set the treasury contract (can only be done once)
     * @param _treasury Address of ArcTreasury contract
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (address(treasury) != address(0)) revert TreasuryAlreadySet();
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = ArcTreasury(_treasury);
        emit TreasurySet(_treasury);
    }

    // ============ Agent Lifecycle ============

    /**
     * @notice Create a new Arc Agent with Circle wallet integration
     * @dev Creator must pass compliance screening (not on sanctions list, etc.)
     * @param tokenURI Agent metadata URI (IPFS recommended)
     * @param circleWalletId Circle Programmable Wallet ID
     * @param circleWalletAddr On-chain wallet address
     * @param modelHash Hash of the ONNX model the agent uses
     * @param proverVersion JOLT-Atlas prover version string
     */
    function createAgent(
        string calldata tokenURI,
        string calldata circleWalletId,
        address circleWalletAddr,
        bytes32 modelHash,
        string calldata proverVersion
    ) external onlyCompliantCreator returns (uint256 agentId) {
        // Register identity
        IERC8004Identity.MetadataEntry[] memory metadata = new IERC8004Identity.MetadataEntry[](4);
        metadata[0] = IERC8004Identity.MetadataEntry("circleWalletId", bytes(circleWalletId));
        metadata[1] = IERC8004Identity.MetadataEntry("circleWalletAddr", abi.encode(circleWalletAddr));
        metadata[2] = IERC8004Identity.MetadataEntry("modelHash", abi.encode(modelHash));
        metadata[3] = IERC8004Identity.MetadataEntry("proverVersion", bytes(proverVersion));

        agentId = identity.register(tokenURI, metadata);

        emit AgentCreated(agentId, msg.sender, circleWalletId, circleWalletAddr);
    }

    /**
     * @notice Create agent with minimal setup (wallet can be added later)
     * @dev Creator must pass compliance screening (not on sanctions list, etc.)
     */
    function createAgentSimple(string calldata tokenURI) external onlyCompliantCreator returns (uint256 agentId) {
        return identity.register(tokenURI);
    }

    // ============ Circle Integration ============

    /**
     * @notice Update Circle wallet details for an agent
     */
    function setCircleWallet(
        uint256 agentId,
        string calldata walletId,
        address walletAddr
    ) external {
        identity.setCircleWallet(agentId, walletId, walletAddr);
    }

    /**
     * @notice Update KYC status from Circle Compliance Engine
     */
    function updateKycStatus(uint256 agentId, uint8 status) external {
        identity.setKycStatus(agentId, status);
    }

    // ============ zkML Proof Submission ============

    /**
     * @notice Submit a zkML proof for validation
     * @param agentId The agent submitting the proof
     * @param proofUri URI to the full proof data (IPFS/Arweave)
     * @param proofHash Hash of the proof for integrity
     * @param proofType Type of proof (authorization, compliance, collision)
     * @param metadata Additional proof metadata
     */
    function submitProof(
        uint256 agentId,
        string calldata proofUri,
        bytes32 proofHash,
        bytes32 proofType,
        ArcProofAttestation.ProofMetadata calldata metadata
    ) external returns (bytes32 requestHash) {
        requestHash = proofHash;

        proofAttestation.validationRequestWithMetadata(
            address(proofAttestation), // Self-validation for now
            agentId,
            proofUri,
            proofHash,
            proofType,
            metadata
        );

        emit ProofSubmitted(agentId, requestHash, proofType);
    }

    // ============ Reputation ============

    /**
     * @notice Give feedback to an agent
     */
    function rateTAgent(
        uint256 agentId,
        uint8 score,
        bytes32 category,
        string calldata detailsUri
    ) external {
        reputation.giveFeedback(
            agentId,
            score,
            category,
            bytes32(0),
            detailsUri,
            keccak256(bytes(detailsUri)),
            ""
        );
    }

    // ============ Aggregate Views ============

    /**
     * @notice Get comprehensive agent profile
     */
    function getAgentProfile(uint256 agentId) external view returns (
        address owner,
        string memory tokenURI,
        uint256 registeredAt,
        string memory circleWalletId,
        address circleWalletAddr,
        uint8 kycStatus,
        uint256 kycTimestamp,
        uint64 feedbackCount,
        uint8 reputationScore,
        uint256 validProofCount
    ) {
        (owner, tokenURI, registeredAt,) = identity.getAgent(agentId);
        (circleWalletId, circleWalletAddr) = identity.getCircleWallet(agentId);
        (kycStatus, kycTimestamp) = identity.getKycStatus(agentId);
        (feedbackCount, reputationScore) = reputation.getOverallScore(agentId);
        validProofCount = proofAttestation.getAgentValidProofCount(agentId);
    }

    /**
     * @notice Check if agent is eligible for transactions (KYC approved + good reputation)
     */
    function isAgentEligible(uint256 agentId, uint8 minReputationScore) external view returns (
        bool eligible,
        string memory reason
    ) {
        // Check KYC
        if (!identity.isKycApproved(agentId)) {
            return (false, "KYC not approved");
        }

        // Check reputation
        (uint64 count, uint8 score) = reputation.getOverallScore(agentId);
        if (count > 0 && score < minReputationScore) {
            return (false, "Reputation too low");
        }

        return (true, "");
    }

    /**
     * @notice Get agent's global ERC-8004 identifier
     */
    function getGlobalAgentId(uint256 agentId) external view returns (string memory) {
        return identity.getGlobalId(agentId);
    }

    // ============ Treasury Operations ============

    /**
     * @notice Deposit USDC to agent's treasury balance
     * @dev Caller must have approved USDC transfer to treasury
     */
    function depositToTreasury(uint256 agentId, uint256 amount) external {
        if (address(treasury) == address(0)) revert TreasuryNotSet();
        treasury.deposit(agentId, amount);
    }

    /**
     * @notice Request a transfer with proof submission in one call
     * @param agentId Agent initiating transfer
     * @param recipient Destination address
     * @param amount USDC amount
     * @param proofUri URI to zkML proof data (IPFS/Arweave)
     * @param proofHash Hash of the proof
     * @param proofMetadata Extended proof metadata
     * @param memo Optional transfer memo
     * @return transferRequestId Transfer request ID in treasury
     * @return proofRequestHash Proof request hash in attestation registry
     */
    function requestTransferWithProof(
        uint256 agentId,
        address recipient,
        uint256 amount,
        string calldata proofUri,
        bytes32 proofHash,
        ArcProofAttestation.ProofMetadata calldata proofMetadata,
        string calldata memo
    ) external returns (uint256 transferRequestId, bytes32 proofRequestHash) {
        if (address(treasury) == address(0)) revert TreasuryNotSet();

        // 1. Submit proof for validation
        proofRequestHash = proofHash;
        proofAttestation.validationRequestWithMetadata(
            address(proofAttestation),
            agentId,
            proofUri,
            proofHash,
            PROOF_AUTHORIZATION,
            proofMetadata
        );

        // 2. Create transfer request in treasury
        transferRequestId = treasury.requestTransfer(
            agentId,
            recipient,
            amount,
            proofHash,
            memo
        );

        emit ProofSubmitted(agentId, proofRequestHash, PROOF_AUTHORIZATION);
        emit TransferInitiated(agentId, transferRequestId, proofHash);
    }

    /**
     * @notice Get comprehensive agent profile including treasury balance
     */
    function getAgentProfileExtended(uint256 agentId) external view returns (
        address agentOwner,
        string memory tokenURI,
        uint256 registeredAt,
        string memory circleWalletId,
        address circleWalletAddr,
        uint8 kycStatus,
        uint256 kycTimestamp,
        uint64 feedbackCount,
        uint8 reputationScore,
        uint256 validProofCount,
        uint256 treasuryBalance
    ) {
        (agentOwner, tokenURI, registeredAt,) = identity.getAgent(agentId);
        (circleWalletId, circleWalletAddr) = identity.getCircleWallet(agentId);
        (kycStatus, kycTimestamp) = identity.getKycStatus(agentId);
        (feedbackCount, reputationScore) = reputation.getOverallScore(agentId);
        validProofCount = proofAttestation.getAgentValidProofCount(agentId);
        treasuryBalance = address(treasury) != address(0) ? treasury.getBalance(agentId) : 0;
    }

    /**
     * @notice Check if agent is eligible for transactions with treasury balance check
     */
    function isAgentEligibleForTransfer(
        uint256 agentId,
        uint256 amount,
        uint8 minReputationScore
    ) external view returns (bool eligible, string memory reason) {
        // Check KYC
        if (!identity.isKycApproved(agentId)) {
            return (false, "KYC not approved");
        }

        // Check reputation
        (uint64 count, uint8 score) = reputation.getOverallScore(agentId);
        if (count > 0 && score < minReputationScore) {
            return (false, "Reputation too low");
        }

        // Check treasury balance
        if (address(treasury) != address(0)) {
            uint256 balance = treasury.getBalance(agentId);
            if (balance < amount) {
                return (false, "Insufficient treasury balance");
            }
        }

        return (true, "");
    }

    // ============ Admin ============

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ============ Compliance Administration ============

    /**
     * @notice Set the compliance oracle contract
     * @param _oracle Address of ArcComplianceOracle
     */
    function setComplianceOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        complianceOracle = ArcComplianceOracle(_oracle);
        emit ComplianceOracleSet(_oracle);
    }

    /**
     * @notice Toggle registration screening on/off
     * @param enabled Whether to screen creators at registration
     */
    function setRegistrationScreening(bool enabled) external onlyOwner {
        registrationScreeningEnabled = enabled;
        emit RegistrationScreeningToggled(enabled);
    }

    /**
     * @notice Manually approve a creator address (bypass screening)
     * @dev Use for pre-approved partners or whitelisted addresses
     */
    function approveCreator(address creator) external onlyOwner {
        if (creator == address(0)) revert ZeroAddress();
        _approvedCreators[creator] = true;
        emit CreatorApproved(creator);
    }

    /**
     * @notice Block a creator address
     * @dev Removes from approved list, will fail compliance check if REJECTED in treasury
     */
    function revokeCreatorApproval(address creator) external onlyOwner {
        _approvedCreators[creator] = false;
        emit CreatorBlocked(creator);
    }

    /**
     * @notice Check if an address is approved to create agents
     */
    function isCreatorApproved(address creator) external view returns (bool) {
        return _approvedCreators[creator];
    }

    /**
     * @notice Check if an address can create agents (considering all compliance checks)
     */
    function canCreateAgent(address creator) external view returns (bool canCreate, string memory reason) {
        if (!registrationScreeningEnabled) {
            return (true, "Screening disabled");
        }

        if (_approvedCreators[creator]) {
            return (true, "Pre-approved");
        }

        if (address(treasury) != address(0)) {
            IArcTreasury.ComplianceStatus status = treasury.getComplianceStatus(creator);
            if (status == IArcTreasury.ComplianceStatus.BLOCKED) {
                return (false, "Address blocked by compliance");
            }
            if (status == IArcTreasury.ComplianceStatus.APPROVED) {
                return (true, "Compliance approved");
            }
            if (status == IArcTreasury.ComplianceStatus.PENDING) {
                return (true, "Compliance pending - allowed");
            }
        }

        return (true, "No compliance record - allowed");
    }
}
