// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC8004Validation.sol";

/**
 * @title ArcProofAttestation
 * @notice ERC-8004 compliant Validation Registry for zkML proof attestation
 * @dev Phase 1: On-chain proof storage and attestation (no cryptographic verification)
 *      Phase 2: Add real on-chain JOLT proof verification
 *
 * This contract stores zkML proofs and allows trusted validators to attest to their validity.
 * The actual cryptographic verification happens off-chain for now.
 *
 * Proof types (tags):
 * - "authorization"       : Spending authorization model proof
 * - "compliance"          : Compliance screening model proof
 * - "collision_severity"  : Impact assessment model proof
 *
 * Response codes:
 * - 0: Pending
 * - 1: Valid (attested)
 * - 2: Invalid
 * - 3: Inconclusive
 */
contract ArcProofAttestation is IERC8004Validation {

    struct ValidationRecord {
        address validatorAddress;
        uint256 agentId;
        string requestUri;          // IPFS/Arweave URI to full proof data
        bytes32 requestHash;        // Hash of the proof for integrity
        uint8 response;             // Validation result
        string responseUri;         // Validator's attestation details
        bytes32 responseHash;
        bytes32 tag;                // Proof type tag
        uint256 requestTimestamp;
        uint256 responseTimestamp;
        bool hasResponse;
    }

    // Extended proof metadata for Arc-specific needs
    struct ProofMetadata {
        bytes32 modelHash;          // Hash of ONNX model used
        bytes32 inputHash;          // Hash of model inputs
        bytes32 outputHash;         // Hash of model outputs
        uint256 proofSize;          // Size of proof in bytes
        uint256 generationTime;     // Proof generation time in ms
        string proverVersion;       // JOLT-Atlas version
    }

    // requestHash => ValidationRecord
    mapping(bytes32 => ValidationRecord) private _validations;
    // requestHash => ProofMetadata
    mapping(bytes32 => ProofMetadata) private _proofMetadata;
    // agentId => requestHashes
    mapping(uint256 => bytes32[]) private _agentValidations;
    // validatorAddress => requestHashes
    mapping(address => bytes32[]) private _validatorRequests;
    // Trusted validators
    mapping(address => bool) public trustedValidators;

    address public owner;
    address public immutable identityRegistry;

    // Response codes
    uint8 public constant RESPONSE_PENDING = 0;
    uint8 public constant RESPONSE_VALID = 1;
    uint8 public constant RESPONSE_INVALID = 2;
    uint8 public constant RESPONSE_INCONCLUSIVE = 3;

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ProofMetadataSet(bytes32 indexed requestHash, bytes32 modelHash, bytes32 inputHash, bytes32 outputHash);

    error NotOwner();
    error NotValidator(address caller);
    error ValidationNotFound(bytes32 requestHash);
    error ValidationAlreadyResponded(bytes32 requestHash);
    error InvalidResponse(uint8 response);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyValidator() {
        if (!trustedValidators[msg.sender]) revert NotValidator(msg.sender);
        _;
    }

    constructor(address _identityRegistry) {
        owner = msg.sender;
        identityRegistry = _identityRegistry;
        trustedValidators[msg.sender] = true; // Owner is initial validator
    }

    // ============ Validator Management ============

    function addValidator(address validator) external onlyOwner {
        trustedValidators[validator] = true;
        emit ValidatorAdded(validator);
    }

    function removeValidator(address validator) external onlyOwner {
        trustedValidators[validator] = false;
        emit ValidatorRemoved(validator);
    }

    // ============ Validation Request ============

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestUri,
        bytes32 requestHash
    ) external override {
        ValidationRecord storage record = _validations[requestHash];
        record.validatorAddress = validatorAddress;
        record.agentId = agentId;
        record.requestUri = requestUri;
        record.requestHash = requestHash;
        record.requestTimestamp = block.timestamp;
        record.response = RESPONSE_PENDING;

        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequest(validatorAddress, agentId, requestUri, requestHash);
    }

    /**
     * @notice Submit a validation request with full proof metadata
     * @dev Arc-specific extension for richer proof tracking
     */
    function validationRequestWithMetadata(
        address validatorAddress,
        uint256 agentId,
        string calldata requestUri,
        bytes32 requestHash,
        bytes32 tag,
        ProofMetadata calldata metadata
    ) external {
        // Create base validation request
        ValidationRecord storage record = _validations[requestHash];
        record.validatorAddress = validatorAddress;
        record.agentId = agentId;
        record.requestUri = requestUri;
        record.requestHash = requestHash;
        record.requestTimestamp = block.timestamp;
        record.response = RESPONSE_PENDING;
        record.tag = tag;

        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        // Store proof metadata
        _proofMetadata[requestHash] = metadata;

        emit ValidationRequest(validatorAddress, agentId, requestUri, requestHash);
        emit ProofMetadataSet(requestHash, metadata.modelHash, metadata.inputHash, metadata.outputHash);
    }

    // ============ Validation Response ============

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseUri,
        bytes32 responseHash,
        bytes32 tag
    ) external override onlyValidator {
        ValidationRecord storage record = _validations[requestHash];
        if (record.requestTimestamp == 0) revert ValidationNotFound(requestHash);
        if (record.hasResponse) revert ValidationAlreadyResponded(requestHash);
        if (response > RESPONSE_INCONCLUSIVE) revert InvalidResponse(response);

        record.response = response;
        record.responseUri = responseUri;
        record.responseHash = responseHash;
        record.tag = tag;
        record.responseTimestamp = block.timestamp;
        record.hasResponse = true;

        emit ValidationResponse(record.validatorAddress, record.agentId, requestHash, response, responseUri, tag);
    }

    // ============ Views ============

    function getValidationStatus(bytes32 requestHash) external view override returns (
        address validatorAddress,
        uint256 agentId,
        uint8 response,
        bytes32 tag,
        uint256 lastUpdate
    ) {
        ValidationRecord storage record = _validations[requestHash];
        return (
            record.validatorAddress,
            record.agentId,
            record.response,
            record.tag,
            record.hasResponse ? record.responseTimestamp : record.requestTimestamp
        );
    }

    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        bytes32 tag
    ) external view override returns (uint64 count, uint8 avgResponse) {
        bytes32[] storage hashes = _agentValidations[agentId];
        uint256 totalResponse;
        uint256 totalCount;

        for (uint256 i = 0; i < hashes.length; i++) {
            ValidationRecord storage record = _validations[hashes[i]];
            if (!record.hasResponse) continue;

            bool matchValidator = validatorAddresses.length == 0;
            for (uint256 j = 0; j < validatorAddresses.length && !matchValidator; j++) {
                if (record.validatorAddress == validatorAddresses[j]) matchValidator = true;
            }

            bool matchTag = tag == bytes32(0) || record.tag == tag;

            if (matchValidator && matchTag) {
                totalResponse += record.response;
                totalCount++;
            }
        }

        count = uint64(totalCount);
        avgResponse = totalCount > 0 ? uint8(totalResponse / totalCount) : 0;
    }

    function getAgentValidations(uint256 agentId) external view override returns (bytes32[] memory) {
        return _agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view override returns (bytes32[] memory) {
        return _validatorRequests[validatorAddress];
    }

    // ============ Arc-specific views ============

    function getProofMetadata(bytes32 requestHash) external view returns (ProofMetadata memory) {
        return _proofMetadata[requestHash];
    }

    function getFullValidation(bytes32 requestHash) external view returns (
        ValidationRecord memory record,
        ProofMetadata memory metadata
    ) {
        return (_validations[requestHash], _proofMetadata[requestHash]);
    }

    function isProofValid(bytes32 requestHash) external view returns (bool) {
        ValidationRecord storage record = _validations[requestHash];
        return record.hasResponse && record.response == RESPONSE_VALID;
    }

    function getAgentValidProofCount(uint256 agentId) external view returns (uint256) {
        bytes32[] storage hashes = _agentValidations[agentId];
        uint256 validCount;
        for (uint256 i = 0; i < hashes.length; i++) {
            ValidationRecord storage record = _validations[hashes[i]];
            if (record.hasResponse && record.response == RESPONSE_VALID) {
                validCount++;
            }
        }
        return validCount;
    }

    /**
     * @notice Check if a specific proof hash has been validated
     * @param proofHash The proof hash to check
     * @return Whether the proof is valid
     */
    function isProofHashValid(bytes32 proofHash) external view returns (bool) {
        ValidationRecord storage record = _validations[proofHash];
        return record.hasResponse && record.response == RESPONSE_VALID;
    }

    /**
     * @notice Validate proof and notify treasury in single transaction
     * @dev Used for atomic proof validation during transfer flow
     * @param requestHash The proof request hash
     * @param response Validation response (0-3)
     * @param responseUri URI to attestation details
     * @param responseHash Hash of response for integrity
     * @param tag Proof type tag
     * @param treasuryAddr ArcTreasury contract address
     * @param transferRequestId Associated transfer request ID
     */
    function validateForTransfer(
        bytes32 requestHash,
        uint8 response,
        string calldata responseUri,
        bytes32 responseHash,
        bytes32 tag,
        address treasuryAddr,
        uint256 transferRequestId
    ) external onlyValidator {
        // Standard validation response
        ValidationRecord storage record = _validations[requestHash];
        if (record.requestTimestamp == 0) revert ValidationNotFound(requestHash);
        if (record.hasResponse) revert ValidationAlreadyResponded(requestHash);
        if (response > RESPONSE_INCONCLUSIVE) revert InvalidResponse(response);

        record.response = response;
        record.responseUri = responseUri;
        record.responseHash = responseHash;
        record.tag = tag;
        record.responseTimestamp = block.timestamp;
        record.hasResponse = true;

        emit ValidationResponse(record.validatorAddress, record.agentId, requestHash, response, responseUri, tag);

        // Notify treasury if valid
        if (response == RESPONSE_VALID && treasuryAddr != address(0)) {
            // Call treasury to update proof validation status
            (bool success,) = treasuryAddr.call(
                abi.encodeWithSignature("submitProofValidation(uint256,bool)", transferRequestId, true)
            );
            // Silently continue if treasury call fails - proof is still recorded
            success; // Suppress unused variable warning
        }
    }

    /**
     * @notice Placeholder for future on-chain cryptographic verification
     * @dev Phase 2: Implement actual JOLT proof verification here
     */
    function verifyProofOnChain(
        bytes32 /* requestHash */,
        bytes calldata /* proof */
    ) external pure returns (bool) {
        // TODO: Phase 2 - Implement actual JOLT-Atlas proof verification
        // This will call a JOLT verifier contract with the proof bytes
        // For now, return false to indicate verification not yet implemented
        return false;
    }

    // ============ Admin ============

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
