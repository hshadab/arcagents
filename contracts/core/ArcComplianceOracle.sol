// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./IArcTreasury.sol";
import "./IArcComplianceOracle.sol";
import "./ArcTreasury.sol";

/**
 * @title ArcComplianceOracle
 * @notice Manages compliance screening requests and authorized oracles
 * @dev Bridges Circle Compliance Engine (off-chain) with on-chain ArcTreasury
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                          Off-Chain Services                                  │
 * │  ┌──────────────────────────┐     ┌──────────────────────────────────────┐  │
 * │  │  Circle Compliance       │     │  Oracle Backend Service              │  │
 * │  │  Engine API              │────▶│  (Webhook Receiver + Tx Submitter)   │  │
 * │  │  - Address Screening     │     │  - Receives Circle webhooks          │  │
 * │  │  - Risk Assessment       │     │  - Signs & submits results           │  │
 * │  └──────────────────────────┘     └──────────────────────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *                                              │
 *                                              │ signed tx
 *                                              ▼
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                         ArcComplianceOracle (this contract)                  │
 * │  - Tracks screening requests                                                 │
 * │  - Verifies oracle signatures                                               │
 * │  - Forwards results to ArcTreasury                                          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Flow:
 * 1. Transfer request triggers ScreeningRequested event
 * 2. Off-chain service listens, calls Circle Compliance Engine API
 * 3. Circle webhook triggers authorized oracle backend
 * 4. Oracle signs result and submits to this contract
 * 5. This contract verifies and forwards to ArcTreasury
 */
contract ArcComplianceOracle is IArcComplianceOracle {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ State Variables ============

    ArcTreasury public immutable treasury;

    address public owner;
    mapping(address => bool) public authorizedOracles;
    mapping(bytes32 => bool) public usedSignatures;

    // Screening request tracking
    uint256 public screeningCounter;
    mapping(bytes32 => ScreeningRequest) public screeningRequests;
    mapping(uint256 => bytes32) public transferToScreening;

    // ============ Errors ============

    error NotOwner();
    error NotAuthorizedOracle();
    error InvalidSignature();
    error SignatureAlreadyUsed();
    error ScreeningNotFound();
    error ScreeningAlreadyCompleted();
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorizedOracle() {
        if (!authorizedOracles[msg.sender]) revert NotAuthorizedOracle();
        _;
    }

    // ============ Constructor ============

    constructor(address _treasury) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = ArcTreasury(_treasury);
        owner = msg.sender;
        authorizedOracles[msg.sender] = true;
        emit OracleAuthorized(msg.sender);
    }

    // ============ Oracle Management ============

    /**
     * @notice Authorize an address to submit screening results
     * @param oracle Address to authorize
     */
    function authorizeOracle(address oracle) external override onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    /**
     * @notice Revoke oracle authorization
     * @param oracle Address to revoke
     */
    function revokeOracle(address oracle) external override onlyOwner {
        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    // ============ Screening Lifecycle ============

    /**
     * @notice Request compliance screening for a transfer
     * @dev Emits event for off-chain service to pick up
     * @param addr Address to screen
     * @param transferRequestId Associated transfer request in ArcTreasury
     * @return requestId Unique screening request identifier
     */
    function requestScreening(
        address addr,
        uint256 transferRequestId
    ) external override returns (bytes32 requestId) {
        if (addr == address(0)) revert ZeroAddress();

        requestId = keccak256(abi.encodePacked(
            addr,
            transferRequestId,
            block.timestamp,
            ++screeningCounter
        ));

        screeningRequests[requestId] = ScreeningRequest({
            requestId: requestId,
            addressToScreen: addr,
            transferRequestId: transferRequestId,
            createdAt: block.timestamp,
            completed: false
        });

        transferToScreening[transferRequestId] = requestId;

        emit ScreeningRequested(requestId, addr, transferRequestId);
    }

    /**
     * @notice Submit screening result from off-chain compliance check
     * @param requestId Screening request identifier
     * @param status Compliance status result
     * @param riskLevel Risk assessment level ("low", "medium", "high")
     * @param signature Signature from authorized oracle backend
     */
    function submitScreeningResult(
        bytes32 requestId,
        IArcTreasury.ComplianceStatus status,
        string calldata riskLevel,
        bytes calldata signature
    ) external override onlyAuthorizedOracle {
        ScreeningRequest storage request = screeningRequests[requestId];
        if (request.requestId == bytes32(0)) revert ScreeningNotFound();
        if (request.completed) revert ScreeningAlreadyCompleted();

        // Verify signature (prevents replay and ensures authenticity)
        bytes32 messageHash = keccak256(abi.encodePacked(
            requestId,
            request.addressToScreen,
            uint8(status),
            riskLevel
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        if (usedSignatures[ethSignedHash]) revert SignatureAlreadyUsed();

        address signer = ethSignedHash.recover(signature);
        if (!authorizedOracles[signer]) revert InvalidSignature();

        usedSignatures[ethSignedHash] = true;
        request.completed = true;

        // Submit to treasury
        treasury.submitComplianceResult(
            request.transferRequestId,
            status,
            requestId
        );

        emit ScreeningCompleted(requestId, request.addressToScreen, status);
    }

    /**
     * @notice Submit screening result without signature (for trusted oracle only)
     * @dev Simplified version when oracle is directly submitting
     */
    function submitScreeningResultDirect(
        bytes32 requestId,
        IArcTreasury.ComplianceStatus status,
        string calldata riskLevel
    ) external onlyAuthorizedOracle {
        ScreeningRequest storage request = screeningRequests[requestId];
        if (request.requestId == bytes32(0)) revert ScreeningNotFound();
        if (request.completed) revert ScreeningAlreadyCompleted();

        request.completed = true;

        // Update compliance record with risk level
        treasury.updateComplianceStatus(
            request.addressToScreen,
            status,
            requestId,
            riskLevel
        );

        // Submit to treasury for transfer flow
        treasury.submitComplianceResult(
            request.transferRequestId,
            status,
            requestId
        );

        emit ScreeningCompleted(requestId, request.addressToScreen, status);
    }

    /**
     * @notice Direct compliance update (for manual/emergency cases)
     * @dev Only owner can use this to bypass normal screening flow
     */
    function directComplianceUpdate(
        address addr,
        IArcTreasury.ComplianceStatus status,
        bytes32 screeningId,
        string calldata riskLevel
    ) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        treasury.updateComplianceStatus(addr, status, screeningId, riskLevel);
    }

    /**
     * @notice Batch authorize multiple addresses as compliant
     * @dev Useful for pre-approving known good addresses
     */
    function batchComplianceUpdate(
        address[] calldata addrs,
        IArcTreasury.ComplianceStatus status,
        string calldata riskLevel
    ) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] == address(0)) continue;

            bytes32 screeningId = keccak256(abi.encodePacked(
                addrs[i],
                block.timestamp,
                i
            ));

            treasury.updateComplianceStatus(addrs[i], status, screeningId, riskLevel);
        }
    }

    // ============ View Functions ============

    function getScreeningRequest(
        bytes32 requestId
    ) external view override returns (ScreeningRequest memory) {
        return screeningRequests[requestId];
    }

    function isAuthorizedOracle(address oracle) external view override returns (bool) {
        return authorizedOracles[oracle];
    }

    function getScreeningByTransfer(
        uint256 transferRequestId
    ) external view returns (bytes32) {
        return transferToScreening[transferRequestId];
    }

    function isScreeningComplete(bytes32 requestId) external view returns (bool) {
        return screeningRequests[requestId].completed;
    }

    // ============ Admin Functions ============

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
