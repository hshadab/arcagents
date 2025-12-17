// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IArcTreasury.sol";

/**
 * @title IArcComplianceOracle
 * @notice Interface for Circle Compliance Engine oracle operations
 * @dev Bridges off-chain Circle Compliance Engine with on-chain ArcTreasury
 *
 * Flow:
 * 1. Transfer request triggers ScreeningRequested event
 * 2. Off-chain service calls Circle Compliance Engine API
 * 3. Circle webhook triggers authorized oracle backend
 * 4. Oracle signs and submits screening result
 * 5. Result is forwarded to ArcTreasury
 */
interface IArcComplianceOracle {
    // ============ Structs ============

    struct ScreeningRequest {
        bytes32 requestId;
        address addressToScreen;
        uint256 transferRequestId;
        uint256 createdAt;
        bool completed;
    }

    // ============ Events ============

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);

    event ScreeningRequested(
        bytes32 indexed requestId,
        address indexed addressToScreen,
        uint256 indexed transferRequestId
    );

    event ScreeningCompleted(
        bytes32 indexed requestId,
        address indexed addressScreened,
        IArcTreasury.ComplianceStatus status
    );

    // ============ Oracle Management ============

    function authorizeOracle(address oracle) external;
    function revokeOracle(address oracle) external;
    function isAuthorizedOracle(address oracle) external view returns (bool);

    // ============ Screening Lifecycle ============

    function requestScreening(
        address addr,
        uint256 transferRequestId
    ) external returns (bytes32 requestId);

    function submitScreeningResult(
        bytes32 requestId,
        IArcTreasury.ComplianceStatus status,
        string calldata riskLevel,
        bytes calldata signature
    ) external;

    // ============ Views ============

    function getScreeningRequest(bytes32 requestId) external view returns (ScreeningRequest memory);
}
