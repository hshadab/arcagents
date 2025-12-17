// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IArcTreasury
 * @notice Interface for Arc Agent USDC Treasury with Circle Compliance Engine integration
 * @dev Implements multi-step transfer flow: Request -> Proof Validation -> Compliance -> Execute
 */
interface IArcTreasury {
    // ============ Enums ============

    enum ComplianceStatus {
        PENDING,    // 0: Awaiting screening
        APPROVED,   // 1: Passed compliance
        BLOCKED,    // 2: Failed compliance / blocklisted
        EXPIRED     // 3: Compliance check expired (needs refresh)
    }

    enum TransferStatus {
        PENDING_PROOF,       // 0: Waiting for zkML proof validation
        PENDING_COMPLIANCE,  // 1: Waiting for compliance screening
        APPROVED,            // 2: Ready for execution
        EXECUTED,            // 3: Transfer completed
        REJECTED,            // 4: Failed validation or compliance
        CANCELLED,           // 5: Cancelled by agent
        EXPIRED              // 6: Request expired
    }

    // ============ Structs ============

    struct TransferRequest {
        uint256 requestId;
        uint256 agentId;
        address recipient;
        uint256 amount;
        bytes32 proofHash;
        TransferStatus status;
        ComplianceStatus recipientCompliance;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 expiresAt;
        string memo;
    }

    struct ComplianceRecord {
        address addressScreened;
        ComplianceStatus status;
        bytes32 screeningId;       // Circle Compliance Engine reference
        uint256 screenedAt;
        uint256 expiresAt;
        string riskLevel;          // "low", "medium", "high"
    }

    // ============ Events ============

    event Deposited(
        uint256 indexed agentId,
        address indexed from,
        uint256 amount,
        bytes32 indexed depositId
    );

    event WithdrawalRequested(
        uint256 indexed agentId,
        address indexed to,
        uint256 amount,
        uint256 indexed requestId
    );

    event TransferRequested(
        uint256 indexed requestId,
        uint256 indexed agentId,
        address indexed recipient,
        uint256 amount,
        bytes32 proofHash
    );

    event TransferExecuted(
        uint256 indexed requestId,
        uint256 indexed agentId,
        address indexed recipient,
        uint256 amount,
        bytes32 proofHash,
        bytes32 complianceId
    );

    event TransferRejected(
        uint256 indexed requestId,
        uint256 indexed agentId,
        string reason
    );

    event ComplianceUpdated(
        address indexed addressScreened,
        ComplianceStatus status,
        bytes32 indexed screeningId
    );

    event AllowlistUpdated(address indexed addr, bool allowed);
    event BlocklistUpdated(address indexed addr, bool blocked);
    event ComplianceOracleUpdated(address indexed oracle);

    // ============ Deposit/Withdrawal ============

    function deposit(uint256 agentId, uint256 amount) external;
    function depositFor(uint256 agentId, uint256 amount, address from) external;
    function withdraw(uint256 agentId, uint256 amount, address to) external;
    function withdrawToCircleWallet(uint256 agentId, uint256 amount) external;

    // ============ Transfer Lifecycle ============

    function requestTransfer(
        uint256 agentId,
        address recipient,
        uint256 amount,
        bytes32 proofHash,
        string calldata memo
    ) external returns (uint256 requestId);

    function submitProofValidation(uint256 requestId, bool isValid) external;

    function submitComplianceResult(
        uint256 requestId,
        ComplianceStatus status,
        bytes32 screeningId
    ) external;

    function executeTransfer(uint256 requestId) external;
    function cancelTransfer(uint256 requestId) external;

    // ============ Compliance Management ============

    function updateComplianceStatus(
        address addr,
        ComplianceStatus status,
        bytes32 screeningId,
        string calldata riskLevel
    ) external;

    function addToAllowlist(address addr) external;
    function removeFromAllowlist(address addr) external;
    function addToBlocklist(address addr) external;
    function removeFromBlocklist(address addr) external;

    // ============ Views ============

    function getBalance(uint256 agentId) external view returns (uint256);
    function getTransferRequest(uint256 requestId) external view returns (TransferRequest memory);
    function getComplianceRecord(address addr) external view returns (ComplianceRecord memory);
    function getComplianceStatus(address addr) external view returns (ComplianceStatus);
    function isAllowlisted(address addr) external view returns (bool);
    function isBlocklisted(address addr) external view returns (bool);
    function canExecuteTransfer(uint256 requestId) external view returns (bool, string memory reason);
}
