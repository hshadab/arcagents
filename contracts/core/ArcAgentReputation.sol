// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC8004Reputation.sol";

/**
 * @title ArcAgentReputation
 * @notice ERC-8004 compliant Reputation Registry for Arc Agents
 * @dev Tracks feedback scores for agent performance, compliance, and reliability
 *
 * Common tags for Arc agents:
 * - "compliance"    : Circle compliance-related feedback
 * - "payment"       : Payment execution feedback
 * - "zkml"          : zkML proof quality feedback
 * - "latency"       : Response time feedback
 * - "accuracy"      : Decision accuracy feedback
 */
contract ArcAgentReputation is IERC8004Reputation {

    struct Feedback {
        address clientAddress;
        uint8 score;           // 0-100
        bytes32 tag1;
        bytes32 tag2;
        string fileuri;        // Off-chain details (IPFS, etc.)
        bytes32 filehash;
        uint256 timestamp;
        bool isRevoked;
    }

    struct Response {
        string responseUri;
        bytes32 responseHash;
        uint256 timestamp;
    }

    // agentId => clientAddress => feedbacks
    mapping(uint256 => mapping(address => Feedback[])) private _feedback;
    // agentId => clientAddress => feedbackIndex => response
    mapping(uint256 => mapping(address => mapping(uint64 => Response))) private _responses;
    // agentId => all client addresses that gave feedback
    mapping(uint256 => address[]) private _agentClients;
    mapping(uint256 => mapping(address => bool)) private _hasGivenFeedback;

    // Reference to identity registry for ownership checks
    address public immutable identityRegistry;

    error InvalidScore(uint8 score);
    error FeedbackNotFound(uint256 agentId, address client, uint64 index);
    error NotFeedbackGiver(address caller);
    error FeedbackAlreadyRevoked();

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    // ============ Give Feedback ============

    function giveFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata fileuri,
        bytes32 filehash,
        bytes calldata /* feedbackAuth - for future signature verification */
    ) external override {
        if (score > 100) revert InvalidScore(score);

        Feedback memory fb = Feedback({
            clientAddress: msg.sender,
            score: score,
            tag1: tag1,
            tag2: tag2,
            fileuri: fileuri,
            filehash: filehash,
            timestamp: block.timestamp,
            isRevoked: false
        });

        _feedback[agentId][msg.sender].push(fb);

        if (!_hasGivenFeedback[agentId][msg.sender]) {
            _hasGivenFeedback[agentId][msg.sender] = true;
            _agentClients[agentId].push(msg.sender);
        }

        emit NewFeedback(agentId, msg.sender, score, tag1, tag2, fileuri, filehash);
    }

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external override {
        Feedback[] storage feedbacks = _feedback[agentId][msg.sender];
        if (feedbackIndex >= feedbacks.length) {
            revert FeedbackNotFound(agentId, msg.sender, feedbackIndex);
        }
        if (feedbacks[feedbackIndex].isRevoked) revert FeedbackAlreadyRevoked();

        feedbacks[feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseUri,
        bytes32 responseHash
    ) external override {
        // Agent owner should be able to respond - simplified: anyone can respond for now
        if (feedbackIndex >= _feedback[agentId][clientAddress].length) {
            revert FeedbackNotFound(agentId, clientAddress, feedbackIndex);
        }

        _responses[agentId][clientAddress][feedbackIndex] = Response({
            responseUri: responseUri,
            responseHash: responseHash,
            timestamp: block.timestamp
        });

        emit ResponseAppended(agentId, clientAddress, feedbackIndex, responseUri, responseHash);
    }

    // ============ Read Feedback ============

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        bytes32 tag1,
        bytes32 tag2
    ) external view override returns (uint64 count, uint8 averageScore) {
        address[] memory clients;
        if (clientAddresses.length > 0) {
            clients = clientAddresses;
        } else {
            clients = _agentClients[agentId];
        }

        uint256 totalScore;
        uint256 totalCount;

        for (uint256 i = 0; i < clients.length; i++) {
            Feedback[] storage feedbacks = _feedback[agentId][clients[i]];
            for (uint256 j = 0; j < feedbacks.length; j++) {
                Feedback storage fb = feedbacks[j];
                if (fb.isRevoked) continue;

                bool matchTag1 = tag1 == bytes32(0) || fb.tag1 == tag1;
                bool matchTag2 = tag2 == bytes32(0) || fb.tag2 == tag2;

                if (matchTag1 && matchTag2) {
                    totalScore += fb.score;
                    totalCount++;
                }
            }
        }

        count = uint64(totalCount);
        averageScore = totalCount > 0 ? uint8(totalScore / totalCount) : 0;
    }

    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 index
    ) external view override returns (uint8 score, bytes32 tag1, bytes32 tag2, bool isRevoked) {
        Feedback[] storage feedbacks = _feedback[agentId][clientAddress];
        if (index >= feedbacks.length) revert FeedbackNotFound(agentId, clientAddress, index);

        Feedback storage fb = feedbacks[index];
        return (fb.score, fb.tag1, fb.tag2, fb.isRevoked);
    }

    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        bytes32 tag1,
        bytes32 tag2,
        bool includeRevoked
    ) external view override returns (
        address[] memory clients,
        uint8[] memory scores,
        bytes32[] memory tag1s,
        bytes32[] memory tag2s,
        bool[] memory revoked
    ) {
        address[] memory allClients;
        if (clientAddresses.length > 0) {
            allClients = clientAddresses;
        } else {
            allClients = _agentClients[agentId];
        }

        // First pass: count matching feedbacks
        uint256 totalMatches;
        for (uint256 i = 0; i < allClients.length; i++) {
            Feedback[] storage feedbacks = _feedback[agentId][allClients[i]];
            for (uint256 j = 0; j < feedbacks.length; j++) {
                Feedback storage fb = feedbacks[j];
                if (!includeRevoked && fb.isRevoked) continue;

                bool matchTag1 = tag1 == bytes32(0) || fb.tag1 == tag1;
                bool matchTag2 = tag2 == bytes32(0) || fb.tag2 == tag2;

                if (matchTag1 && matchTag2) totalMatches++;
            }
        }

        // Allocate arrays
        clients = new address[](totalMatches);
        scores = new uint8[](totalMatches);
        tag1s = new bytes32[](totalMatches);
        tag2s = new bytes32[](totalMatches);
        revoked = new bool[](totalMatches);

        // Second pass: populate arrays
        uint256 idx;
        for (uint256 i = 0; i < allClients.length; i++) {
            Feedback[] storage feedbacks = _feedback[agentId][allClients[i]];
            for (uint256 j = 0; j < feedbacks.length; j++) {
                Feedback storage fb = feedbacks[j];
                if (!includeRevoked && fb.isRevoked) continue;

                bool matchTag1 = tag1 == bytes32(0) || fb.tag1 == tag1;
                bool matchTag2 = tag2 == bytes32(0) || fb.tag2 == tag2;

                if (matchTag1 && matchTag2) {
                    clients[idx] = fb.clientAddress;
                    scores[idx] = fb.score;
                    tag1s[idx] = fb.tag1;
                    tag2s[idx] = fb.tag2;
                    revoked[idx] = fb.isRevoked;
                    idx++;
                }
            }
        }
    }

    function getLastIndex(uint256 agentId, address clientAddress) external view override returns (uint64) {
        uint256 len = _feedback[agentId][clientAddress].length;
        return len > 0 ? uint64(len - 1) : 0;
    }

    // ============ Arc-specific helpers ============

    function getComplianceScore(uint256 agentId) external view returns (uint64 count, uint8 avg) {
        return this.getSummary(agentId, new address[](0), keccak256("compliance"), bytes32(0));
    }

    function getPaymentScore(uint256 agentId) external view returns (uint64 count, uint8 avg) {
        return this.getSummary(agentId, new address[](0), keccak256("payment"), bytes32(0));
    }

    function getZkmlScore(uint256 agentId) external view returns (uint64 count, uint8 avg) {
        return this.getSummary(agentId, new address[](0), keccak256("zkml"), bytes32(0));
    }

    function getOverallScore(uint256 agentId) external view returns (uint64 count, uint8 avg) {
        return this.getSummary(agentId, new address[](0), bytes32(0), bytes32(0));
    }

    function getAgentClients(uint256 agentId) external view returns (address[] memory) {
        return _agentClients[agentId];
    }
}
