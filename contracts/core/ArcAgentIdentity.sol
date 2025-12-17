// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC8004Identity.sol";

/**
 * @title ArcAgentIdentity
 * @notice ERC-8004 compliant Identity Registry for Arc Agents
 * @dev Implements soulbound NFT identity with Circle wallet + KYC metadata
 *
 * Global Agent ID format: eip155:{chainId}:{this}:{agentId}
 *
 * Reserved metadata keys:
 * - "circleWalletId"    : Circle Programmable Wallet ID
 * - "circleWalletAddr"  : On-chain wallet address
 * - "kycStatus"         : KYC status from Circle Compliance (0=none, 1=pending, 2=approved, 3=rejected)
 * - "kycTimestamp"      : Last KYC check timestamp
 * - "modelHash"         : Commitment to the ONNX model the agent uses
 * - "proverVersion"     : JOLT-Atlas prover version
 */
contract ArcAgentIdentity is IERC8004Identity {

    // Agent identity data
    struct AgentData {
        address owner;
        string tokenURI;
        uint256 registeredAt;
        bool exists;
    }

    // State
    uint256 private _nextAgentId = 1;
    mapping(uint256 => AgentData) private _agents;
    mapping(uint256 => mapping(bytes32 => bytes)) private _metadata;
    mapping(address => uint256[]) private _ownerAgents;

    // Soulbound: prevent transfers
    mapping(uint256 => bool) private _locked;

    // Admin and compliance oracle
    address public owner;
    address public complianceOracle;

    // Errors
    error AgentNotFound(uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error AgentIsSoulbound(uint256 agentId);
    error InvalidMetadataKey();
    error NotOwner();
    error ZeroAddress();

    // ============ Modifiers ============

    modifier onlyContractOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgentOwner(uint256 agentId) {
        if (!_agents[agentId].exists) revert AgentNotFound(agentId);
        if (_agents[agentId].owner != msg.sender) revert NotAgentOwner(agentId, msg.sender);
        _;
    }

    modifier onlyAgentOwnerOrOracle(uint256 agentId) {
        if (!_agents[agentId].exists) revert AgentNotFound(agentId);
        if (_agents[agentId].owner != msg.sender && msg.sender != complianceOracle) {
            revert NotAgentOwner(agentId, msg.sender);
        }
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ Registration ============

    function register(
        string calldata tokenURI,
        MetadataEntry[] calldata metadata
    ) external override returns (uint256 agentId) {
        agentId = _register(tokenURI);

        for (uint256 i = 0; i < metadata.length; i++) {
            _setMetadata(agentId, metadata[i].key, metadata[i].value);
        }
    }

    function register(string calldata tokenURI) external override returns (uint256 agentId) {
        return _register(tokenURI);
    }

    function register() external override returns (uint256 agentId) {
        return _register("");
    }

    function _register(string memory tokenURI) internal returns (uint256 agentId) {
        agentId = _nextAgentId++;

        _agents[agentId] = AgentData({
            owner: msg.sender,
            tokenURI: tokenURI,
            registeredAt: block.timestamp,
            exists: true
        });

        _locked[agentId] = true; // Soulbound by default
        _ownerAgents[msg.sender].push(agentId);

        emit Registered(agentId, tokenURI, msg.sender);
    }

    // ============ Metadata ============

    function getMetadata(uint256 agentId, string calldata key) external view override returns (bytes memory) {
        if (!_agents[agentId].exists) revert AgentNotFound(agentId);
        return _metadata[agentId][keccak256(bytes(key))];
    }

    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external override onlyAgentOwner(agentId) {
        _setMetadata(agentId, key, value);
    }

    function _setMetadata(uint256 agentId, string memory key, bytes memory value) internal {
        if (bytes(key).length == 0) revert InvalidMetadataKey();
        _metadata[agentId][keccak256(bytes(key))] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    // ============ Arc-specific convenience methods ============

    function setCircleWallet(
        uint256 agentId,
        string calldata walletId,
        address walletAddr
    ) external onlyAgentOwner(agentId) {
        _setMetadata(agentId, "circleWalletId", bytes(walletId));
        _setMetadata(agentId, "circleWalletAddr", abi.encode(walletAddr));
    }

    function setKycStatus(
        uint256 agentId,
        uint8 status
    ) external onlyAgentOwnerOrOracle(agentId) {
        _setMetadata(agentId, "kycStatus", abi.encode(status));
        _setMetadata(agentId, "kycTimestamp", abi.encode(block.timestamp));
    }

    // ============ Admin Functions ============

    function setComplianceOracle(address _oracle) external onlyContractOwner {
        complianceOracle = _oracle;
    }

    function transferOwnership(address newOwner) external onlyContractOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function setModelCommitment(
        uint256 agentId,
        bytes32 modelHash,
        string calldata proverVersion
    ) external onlyAgentOwner(agentId) {
        _setMetadata(agentId, "modelHash", abi.encode(modelHash));
        _setMetadata(agentId, "proverVersion", bytes(proverVersion));
    }

    // ============ Views ============

    function getAgent(uint256 agentId) external view returns (
        address owner,
        string memory tokenURI,
        uint256 registeredAt,
        bool isSoulbound
    ) {
        if (!_agents[agentId].exists) revert AgentNotFound(agentId);
        AgentData storage agent = _agents[agentId];
        return (agent.owner, agent.tokenURI, agent.registeredAt, _locked[agentId]);
    }

    function getCircleWallet(uint256 agentId) external view returns (
        string memory walletId,
        address walletAddr
    ) {
        if (!_agents[agentId].exists) revert AgentNotFound(agentId);
        walletId = string(_metadata[agentId][keccak256("circleWalletId")]);
        bytes memory addrBytes = _metadata[agentId][keccak256("circleWalletAddr")];
        if (addrBytes.length > 0) {
            walletAddr = abi.decode(addrBytes, (address));
        }
    }

    function getKycStatus(uint256 agentId) external view returns (uint8 status, uint256 timestamp) {
        if (!_agents[agentId].exists) revert AgentNotFound(agentId);
        bytes memory statusBytes = _metadata[agentId][keccak256("kycStatus")];
        bytes memory tsBytes = _metadata[agentId][keccak256("kycTimestamp")];
        if (statusBytes.length > 0) status = abi.decode(statusBytes, (uint8));
        if (tsBytes.length > 0) timestamp = abi.decode(tsBytes, (uint256));
    }

    function isKycApproved(uint256 agentId) external view returns (bool) {
        bytes memory statusBytes = _metadata[agentId][keccak256("kycStatus")];
        if (statusBytes.length == 0) return false;
        return abi.decode(statusBytes, (uint8)) == 2; // 2 = approved
    }

    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerAgents[owner];
    }

    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    function getGlobalId(uint256 agentId) external view returns (string memory) {
        if (!_agents[agentId].exists) revert AgentNotFound(agentId);
        return string(abi.encodePacked(
            "eip155:",
            _toString(block.chainid),
            ":",
            _toHexString(address(this)),
            ":",
            _toString(agentId)
        ));
    }

    // ============ Utilities ============

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(uint160(addr) >> (8 * (19 - i)) >> 4) & 0xf];
            str[3 + i * 2] = alphabet[uint8(uint160(addr) >> (8 * (19 - i))) & 0xf];
        }
        return string(str);
    }
}
