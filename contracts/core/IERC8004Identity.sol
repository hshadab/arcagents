// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC8004Identity
 * @notice ERC-8004 Identity Registry interface for trustless agents
 * @dev Based on ERC-721 with URIStorage extension
 */
interface IERC8004Identity {
    struct MetadataEntry {
        string key;
        bytes value;
    }

    event Registered(uint256 indexed agentId, string tokenURI, address indexed owner);
    event MetadataSet(uint256 indexed agentId, string indexed indexedKey, string key, bytes value);

    function register(string calldata tokenURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);
    function register(string calldata tokenURI) external returns (uint256 agentId);
    function register() external returns (uint256 agentId);

    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory value);
    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external;
}
