// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IArcTreasury.sol";
import "./ArcAgentIdentity.sol";
import "./ArcProofAttestation.sol";

/**
 * @title ArcTreasury
 * @notice USDC Treasury with Circle Compliance Engine integration for Arc Agents
 * @dev Implements multi-step transfer flow: Request -> Proof -> Compliance -> Execute
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                              ArcTreasury                                     │
 * │  ┌──────────────────┐  ┌──────────────────────┐  ┌───────────────────────┐  │
 * │  │   USDC Custody   │  │  Compliance Oracle   │  │   Transfer Requests   │  │
 * │  │  Agent Balances  │  │  Allowlist/Blocklist │  │   Multi-step Flow     │  │
 * │  │  Deposit/Withdraw│  │  Screening Results   │  │   zkML Proof Valid    │  │
 * │  └──────────────────┘  └──────────────────────┘  └───────────────────────┘  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Transfer Flow:
 * ┌─────────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────────┐
 * │   Request   │───▶│ zkML Proof   │───▶│   Compliance   │───▶│   Execute    │
 * │   Transfer  │    │  Validation  │    │   Screening    │    │   Transfer   │
 * └─────────────┘    └──────────────┘    └────────────────┘    └──────────────┘
 *      Agent            Validator           Oracle              Anyone/Keeper
 *
 * Gas Fee Handling:
 * - Deposits: Depositor pays gas
 * - Transfer requests: Agent owner pays gas
 * - Proof validation: Validator pays gas (platform subsidized)
 * - Compliance updates: Oracle pays gas (platform operated)
 * - Execution: Keeper/relayer pays gas (can be subsidized)
 */
contract ArcTreasury is IArcTreasury, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable usdc;
    ArcAgentIdentity public immutable identityRegistry;
    ArcProofAttestation public immutable proofAttestation;

    address public owner;
    address public complianceOracle;
    address public feeCollector;

    uint256 public transferRequestCounter;
    uint256 public constant TRANSFER_EXPIRY = 24 hours;
    uint256 public constant COMPLIANCE_VALIDITY = 7 days;
    uint256 public transferFeeRate; // Basis points (100 = 1%)
    uint256 public constant MAX_FEE_RATE = 100; // 1% max

    // Agent USDC balances
    mapping(uint256 => uint256) private _agentBalances;

    // Transfer requests
    mapping(uint256 => TransferRequest) private _transferRequests;
    mapping(uint256 => uint256[]) private _agentTransferRequests;

    // Compliance records
    mapping(address => ComplianceRecord) private _complianceRecords;
    mapping(address => bool) private _allowlist;
    mapping(address => bool) private _blocklist;

    // Proof validation cache for transfers
    mapping(uint256 => bool) private _proofValidated;

    // ============ Errors ============

    error NotOwner();
    error NotAgentOwner(uint256 agentId);
    error NotComplianceOracle();
    error NotValidator();
    error InsufficientBalance(uint256 agentId, uint256 required, uint256 available);
    error TransferNotFound(uint256 requestId);
    error InvalidTransferStatus(uint256 requestId, TransferStatus current, TransferStatus required);
    error RecipientBlocked(address recipient);
    error ComplianceNotApproved(address recipient);
    error ProofNotValidated(uint256 requestId);
    error TransferExpired(uint256 requestId);
    error AgentNotKycApproved(uint256 agentId);
    error ZeroAmount();
    error ZeroAddress();
    error FeeTooHigh();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgentOwner(uint256 agentId) {
        (address agentOwner,,,) = identityRegistry.getAgent(agentId);
        if (msg.sender != agentOwner) revert NotAgentOwner(agentId);
        _;
    }

    modifier onlyComplianceOracle() {
        if (msg.sender != complianceOracle) revert NotComplianceOracle();
        _;
    }

    modifier onlyValidator() {
        if (!proofAttestation.trustedValidators(msg.sender)) revert NotValidator();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _identityRegistry,
        address _proofAttestation,
        address _complianceOracle,
        address _feeCollector
    ) {
        usdc = IERC20(_usdc);
        identityRegistry = ArcAgentIdentity(_identityRegistry);
        proofAttestation = ArcProofAttestation(_proofAttestation);
        complianceOracle = _complianceOracle;
        feeCollector = _feeCollector;
        owner = msg.sender;
    }

    // ============ Deposit Functions ============

    /**
     * @notice Deposit USDC into agent's treasury balance
     * @param agentId The agent to credit
     * @param amount Amount of USDC to deposit
     */
    function deposit(uint256 agentId, uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Verify agent exists
        identityRegistry.getAgent(agentId);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        _agentBalances[agentId] += amount;

        bytes32 depositId = keccak256(abi.encodePacked(
            agentId, msg.sender, amount, block.timestamp, block.number
        ));

        emit Deposited(agentId, msg.sender, amount, depositId);
    }

    /**
     * @notice Deposit USDC on behalf of another address (requires approval)
     * @dev Useful for Circle wallet deposits via approved relayer
     */
    function depositFor(
        uint256 agentId,
        uint256 amount,
        address from
    ) external override nonReentrant {
        if (amount == 0) revert ZeroAmount();

        identityRegistry.getAgent(agentId);

        usdc.safeTransferFrom(from, address(this), amount);
        _agentBalances[agentId] += amount;

        bytes32 depositId = keccak256(abi.encodePacked(
            agentId, from, amount, block.timestamp, block.number
        ));

        emit Deposited(agentId, from, amount, depositId);
    }

    // ============ Withdrawal Functions ============

    /**
     * @notice Withdraw USDC to specified address
     * @param agentId The agent's treasury to withdraw from
     * @param amount Amount to withdraw
     * @param to Destination address
     */
    function withdraw(
        uint256 agentId,
        uint256 amount,
        address to
    ) external override onlyAgentOwner(agentId) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (_agentBalances[agentId] < amount) {
            revert InsufficientBalance(agentId, amount, _agentBalances[agentId]);
        }

        // Check recipient compliance
        if (_blocklist[to]) revert RecipientBlocked(to);

        _agentBalances[agentId] -= amount;
        usdc.safeTransfer(to, amount);

        emit WithdrawalRequested(agentId, to, amount, 0);
    }

    /**
     * @notice Withdraw to agent's linked Circle wallet
     */
    function withdrawToCircleWallet(
        uint256 agentId,
        uint256 amount
    ) external override onlyAgentOwner(agentId) nonReentrant {
        (, address circleWalletAddr) = identityRegistry.getCircleWallet(agentId);
        if (circleWalletAddr == address(0)) revert ZeroAddress();

        if (_agentBalances[agentId] < amount) {
            revert InsufficientBalance(agentId, amount, _agentBalances[agentId]);
        }

        _agentBalances[agentId] -= amount;
        usdc.safeTransfer(circleWalletAddr, amount);

        emit WithdrawalRequested(agentId, circleWalletAddr, amount, 0);
    }

    // ============ Transfer Lifecycle ============

    /**
     * @notice Request a transfer with zkML proof reference
     * @param agentId Agent initiating transfer
     * @param recipient Destination address
     * @param amount USDC amount
     * @param proofHash Hash of zkML authorization proof
     * @param memo Optional transfer memo
     * @return requestId Unique transfer request identifier
     */
    function requestTransfer(
        uint256 agentId,
        address recipient,
        uint256 amount,
        bytes32 proofHash,
        string calldata memo
    ) external override onlyAgentOwner(agentId) returns (uint256 requestId) {
        if (amount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();
        if (_blocklist[recipient]) revert RecipientBlocked(recipient);

        // Verify agent KYC
        if (!identityRegistry.isKycApproved(agentId)) {
            revert AgentNotKycApproved(agentId);
        }

        // Verify sufficient balance
        if (_agentBalances[agentId] < amount) {
            revert InsufficientBalance(agentId, amount, _agentBalances[agentId]);
        }

        requestId = ++transferRequestCounter;

        _transferRequests[requestId] = TransferRequest({
            requestId: requestId,
            agentId: agentId,
            recipient: recipient,
            amount: amount,
            proofHash: proofHash,
            status: TransferStatus.PENDING_PROOF,
            recipientCompliance: ComplianceStatus.PENDING,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            expiresAt: block.timestamp + TRANSFER_EXPIRY,
            memo: memo
        });

        _agentTransferRequests[agentId].push(requestId);

        emit TransferRequested(requestId, agentId, recipient, amount, proofHash);
    }

    /**
     * @notice Submit proof validation result (called by trusted validator)
     * @param requestId Transfer request to validate
     * @param isValid Whether the zkML proof is valid
     */
    function submitProofValidation(
        uint256 requestId,
        bool isValid
    ) external override onlyValidator {
        TransferRequest storage request = _transferRequests[requestId];
        if (request.requestId == 0) revert TransferNotFound(requestId);
        if (request.status != TransferStatus.PENDING_PROOF) {
            revert InvalidTransferStatus(requestId, request.status, TransferStatus.PENDING_PROOF);
        }
        if (block.timestamp > request.expiresAt) {
            request.status = TransferStatus.EXPIRED;
            revert TransferExpired(requestId);
        }

        if (isValid) {
            _proofValidated[requestId] = true;
            request.status = TransferStatus.PENDING_COMPLIANCE;
            request.updatedAt = block.timestamp;
        } else {
            request.status = TransferStatus.REJECTED;
            request.updatedAt = block.timestamp;
            emit TransferRejected(requestId, request.agentId, "Proof validation failed");
        }
    }

    /**
     * @notice Submit compliance screening result (called by compliance oracle)
     * @param requestId Transfer request
     * @param status Compliance status
     * @param screeningId Circle Compliance Engine reference
     */
    function submitComplianceResult(
        uint256 requestId,
        ComplianceStatus status,
        bytes32 screeningId
    ) external override onlyComplianceOracle {
        TransferRequest storage request = _transferRequests[requestId];
        if (request.requestId == 0) revert TransferNotFound(requestId);
        if (request.status != TransferStatus.PENDING_COMPLIANCE) {
            revert InvalidTransferStatus(requestId, request.status, TransferStatus.PENDING_COMPLIANCE);
        }
        if (block.timestamp > request.expiresAt) {
            request.status = TransferStatus.EXPIRED;
            revert TransferExpired(requestId);
        }

        request.recipientCompliance = status;
        request.updatedAt = block.timestamp;

        // Update global compliance record
        _complianceRecords[request.recipient] = ComplianceRecord({
            addressScreened: request.recipient,
            status: status,
            screeningId: screeningId,
            screenedAt: block.timestamp,
            expiresAt: block.timestamp + COMPLIANCE_VALIDITY,
            riskLevel: ""
        });

        emit ComplianceUpdated(request.recipient, status, screeningId);

        if (status == ComplianceStatus.APPROVED) {
            request.status = TransferStatus.APPROVED;
        } else {
            request.status = TransferStatus.REJECTED;
            emit TransferRejected(requestId, request.agentId, "Compliance check failed");
        }
    }

    /**
     * @notice Execute an approved transfer
     * @dev Can be called by anyone once transfer is approved (enables keepers/relayers)
     * @param requestId Transfer request to execute
     */
    function executeTransfer(uint256 requestId) external override nonReentrant {
        TransferRequest storage request = _transferRequests[requestId];
        if (request.requestId == 0) revert TransferNotFound(requestId);
        if (request.status != TransferStatus.APPROVED) {
            revert InvalidTransferStatus(requestId, request.status, TransferStatus.APPROVED);
        }
        if (block.timestamp > request.expiresAt) {
            request.status = TransferStatus.EXPIRED;
            revert TransferExpired(requestId);
        }

        // Final checks
        if (!_proofValidated[requestId]) revert ProofNotValidated(requestId);
        if (_blocklist[request.recipient]) revert RecipientBlocked(request.recipient);

        uint256 agentId = request.agentId;
        uint256 amount = request.amount;
        address recipient = request.recipient;

        // Verify balance still available
        if (_agentBalances[agentId] < amount) {
            revert InsufficientBalance(agentId, amount, _agentBalances[agentId]);
        }

        // Calculate and deduct fee
        uint256 fee = (amount * transferFeeRate) / 10000;
        uint256 netAmount = amount - fee;

        // Execute transfer
        _agentBalances[agentId] -= amount;
        request.status = TransferStatus.EXECUTED;
        request.updatedAt = block.timestamp;

        usdc.safeTransfer(recipient, netAmount);
        if (fee > 0 && feeCollector != address(0)) {
            usdc.safeTransfer(feeCollector, fee);
        }

        emit TransferExecuted(
            requestId,
            agentId,
            recipient,
            netAmount,
            request.proofHash,
            _complianceRecords[recipient].screeningId
        );
    }

    /**
     * @notice Cancel a pending transfer request
     * @param requestId Request to cancel
     */
    function cancelTransfer(
        uint256 requestId
    ) external override {
        TransferRequest storage request = _transferRequests[requestId];
        if (request.requestId == 0) revert TransferNotFound(requestId);

        // Only agent owner can cancel
        (address agentOwner,,,) = identityRegistry.getAgent(request.agentId);
        if (msg.sender != agentOwner) revert NotAgentOwner(request.agentId);

        // Can only cancel non-executed requests
        if (request.status == TransferStatus.EXECUTED) {
            revert InvalidTransferStatus(requestId, request.status, TransferStatus.PENDING_PROOF);
        }

        request.status = TransferStatus.CANCELLED;
        request.updatedAt = block.timestamp;
    }

    // ============ Compliance Management ============

    /**
     * @notice Update compliance status for an address (oracle only)
     */
    function updateComplianceStatus(
        address addr,
        ComplianceStatus status,
        bytes32 screeningId,
        string calldata riskLevel
    ) external override onlyComplianceOracle {
        _complianceRecords[addr] = ComplianceRecord({
            addressScreened: addr,
            status: status,
            screeningId: screeningId,
            screenedAt: block.timestamp,
            expiresAt: block.timestamp + COMPLIANCE_VALIDITY,
            riskLevel: riskLevel
        });

        emit ComplianceUpdated(addr, status, screeningId);
    }

    function addToAllowlist(address addr) external override onlyOwner {
        _allowlist[addr] = true;
        emit AllowlistUpdated(addr, true);
    }

    function removeFromAllowlist(address addr) external override onlyOwner {
        _allowlist[addr] = false;
        emit AllowlistUpdated(addr, false);
    }

    function addToBlocklist(address addr) external override onlyOwner {
        _blocklist[addr] = true;
        emit BlocklistUpdated(addr, true);
    }

    function removeFromBlocklist(address addr) external override onlyOwner {
        _blocklist[addr] = false;
        emit BlocklistUpdated(addr, false);
    }

    // ============ Admin Functions ============

    function setComplianceOracle(address _oracle) external onlyOwner {
        complianceOracle = _oracle;
        emit ComplianceOracleUpdated(_oracle);
    }

    function setFeeCollector(address _collector) external onlyOwner {
        feeCollector = _collector;
    }

    function setTransferFeeRate(uint256 _rate) external onlyOwner {
        if (_rate > MAX_FEE_RATE) revert FeeTooHigh();
        transferFeeRate = _rate;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    // ============ View Functions ============

    function getBalance(uint256 agentId) external view override returns (uint256) {
        return _agentBalances[agentId];
    }

    function getTransferRequest(
        uint256 requestId
    ) external view override returns (TransferRequest memory) {
        return _transferRequests[requestId];
    }

    function getComplianceRecord(
        address addr
    ) external view override returns (ComplianceRecord memory) {
        return _complianceRecords[addr];
    }

    function getComplianceStatus(
        address addr
    ) external view override returns (ComplianceStatus) {
        return _complianceRecords[addr].status;
    }

    function isAllowlisted(address addr) external view override returns (bool) {
        return _allowlist[addr];
    }

    function isBlocklisted(address addr) external view override returns (bool) {
        return _blocklist[addr];
    }

    function canExecuteTransfer(
        uint256 requestId
    ) external view override returns (bool, string memory reason) {
        TransferRequest storage request = _transferRequests[requestId];

        if (request.requestId == 0) return (false, "Request not found");
        if (request.status != TransferStatus.APPROVED) return (false, "Not approved");
        if (block.timestamp > request.expiresAt) return (false, "Expired");
        if (!_proofValidated[requestId]) return (false, "Proof not validated");
        if (_blocklist[request.recipient]) return (false, "Recipient blocked");
        if (_agentBalances[request.agentId] < request.amount) return (false, "Insufficient balance");

        return (true, "");
    }

    function getAgentTransferRequests(uint256 agentId) external view returns (uint256[] memory) {
        return _agentTransferRequests[agentId];
    }

    function isComplianceValid(address addr) external view returns (bool) {
        ComplianceRecord storage record = _complianceRecords[addr];
        return record.status == ComplianceStatus.APPROVED &&
               block.timestamp < record.expiresAt;
    }

    function totalTreasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
