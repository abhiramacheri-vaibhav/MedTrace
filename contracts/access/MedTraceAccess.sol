// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  MedTraceAccess
 * @author Team BlockRx (CSE 540, Fall B 2026)
 * @notice Role-based permissions for MedTrace, built on OpenZeppelin AccessControl.
 *
 * Who can do what:
 *  - DEFAULT_ADMIN_ROLE : network operator (the deployer). Onboards and removes
 *                         participants. Cannot change batch data.
 *  - MANUFACTURER_ROLE  : registers new batches.
 *  - DISTRIBUTOR_ROLE   : receives batches and passes them on.
 *  - PHARMACY_ROLE      : receives batches and dispenses them to patients.
 *  - REGULATOR_ROLE     : certifies and recalls batches, attaches certificates.
 *  - SENSOR_ROLE        : wallet used by the IoT temperature simulator.
 *  - Patients need no role: they only call free read-only view functions.
 *
 * Each participant also gets a display name (e.g. "Acme Pharma") so the web app
 * can show names instead of raw wallet addresses.
 */
abstract contract MedTraceAccess is AccessControl {
    /// @notice Participant registration requires a nonzero wallet.
    error ZeroAddress();

    /// @notice Participant registration requires one of the five supply-chain roles.
    error UnknownRole();

    /// @notice Permission to register batches and establish their origin.
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    /// @notice Permission to receive batches for onward distribution.
    bytes32 public constant DISTRIBUTOR_ROLE  = keccak256("DISTRIBUTOR_ROLE");
    /// @notice Permission to receive batches and dispense eligible medicine.
    bytes32 public constant PHARMACY_ROLE     = keccak256("PHARMACY_ROLE");
    /// @notice Permission to certify or recall batches and attach audit documents.
    bytes32 public constant REGULATOR_ROLE    = keccak256("REGULATOR_ROLE");
    /// @notice Permission to record out-of-range readings from the IoT simulator.
    bytes32 public constant SENSOR_ROLE       = keccak256("SENSOR_ROLE");

    /// @notice Display name of each onboarded participant (empty if unknown).
    mapping(address => string) public participantName;

    event ParticipantRegistered(address indexed account, bytes32 indexed role, string name);
    event ParticipantRemoved(address indexed account, bytes32 indexed role);

    /// @param admin Wallet that will onboard participants (usually the deployer).
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Onboard a participant: give `account` a supply-chain role and a name.
     * @dev    Only the admin. Rejects roles that are not part of MedTrace.
     */
    function registerParticipant(address account, bytes32 role, string calldata name)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (account == address(0)) revert ZeroAddress();
        if (!_isSupplyChainRole(role)) revert UnknownRole();
        participantName[account] = name;
        _grantRole(role, account);
        emit ParticipantRegistered(account, role, name);
    }

    /// @notice Remove a role from a participant (e.g. a pharmacy loses its licence).
    /// @dev Only the admin; existing batch history and the display name are preserved.
    function removeParticipant(address account, bytes32 role) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
        emit ParticipantRemoved(account, role);
    }

    /// @dev True for the five MedTrace roles; used to block typos and unknown roles.
    function _isSupplyChainRole(bytes32 role) internal pure returns (bool) {
        return role == MANUFACTURER_ROLE
            || role == DISTRIBUTOR_ROLE
            || role == PHARMACY_ROLE
            || role == REGULATOR_ROLE
            || role == SENSOR_ROLE;
    }

    /// @dev True if `account` can legally receive a batch in a hand-off.
    function _canReceiveBatch(address account) internal view returns (bool) {
        return hasRole(DISTRIBUTOR_ROLE, account) || hasRole(PHARMACY_ROLE, account);
    }
}
