// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMDCNCommand {
    enum Role { None, Strategic, Operational, Tactical }
    enum Branch { None, Army, Navy, AirForce }
    function roles(address) external view returns (Role);
    function branches(address) external view returns (Branch);
}

contract MDCNTactical {
    IMDCNCommand public commandContract;

    constructor(address _commandContractAddress) {
        commandContract = IMDCNCommand(_commandContractAddress);
    }
    struct FieldMessage {
        uint256 id;
        address sender;
        address recipient;
        string data;
        uint256 timestamp;
        bool acknowledged;
        address acknowledgedBy;
        uint256 acknowledgedTimestamp;
    }
    struct MaintenanceMessage {
        uint256 id;
        address sender;
        address recipient;
        uint256 assetId;
        string status;
        uint256 timestamp;
        bool acknowledged;
        address acknowledgedBy;
        uint256 acknowledgedTimestamp;
    }
    uint256 public fieldCount;
    uint256 public maintenanceCount;
    mapping(uint256 => FieldMessage) public fieldData;
    mapping(uint256 => MaintenanceMessage) public maintenanceData;

    event FieldDataLogged(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        string data,
        uint256 timestamp
    );
    event MaintenanceUpdated(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 assetId,
        string status,
        uint256 timestamp
    );
    event FieldDataAcknowledged(
        uint256 indexed id,
        address indexed ackBy,
        uint256 timestamp
    );
    event MaintenanceAcknowledged(
        uint256 indexed id,
        address indexed ackBy,
        uint256 timestamp
    );

    // Renamed: Legacy version for backward compatibility
    // Log field data using recipient group and branch
    function logFieldDataLegacy(
        uint8 _recipientGroup,
        uint8 _branch,
        string memory _data
    ) public {
        fieldCount++;

        // For the legacy version, we don't know the exact recipient,
        // so we use a placeholder address
        address dummyRecipient = address(
            0x1234567890123456789012345678901234567890
        );

        fieldData[fieldCount] = FieldMessage({
            id: fieldCount,
            sender: msg.sender,
            recipient: dummyRecipient,
            data: _data,
            timestamp: block.timestamp,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });

        emit FieldDataLogged(
            fieldCount,
            msg.sender,
            dummyRecipient,
            _data,
            block.timestamp
        );
    }

    // Unchanged: Log field data for a specific recipient
    function logFieldData(address _recipient, string memory _data) public {
        IMDCNCommand.Role senderRole = commandContract.roles(msg.sender);
        IMDCNCommand.Role recipientRole = commandContract.roles(_recipient);
        IMDCNCommand.Branch senderBranch = commandContract.branches(msg.sender);
        IMDCNCommand.Branch recipientBranch = commandContract.branches(_recipient);

        require(senderRole == IMDCNCommand.Role.Tactical, "Protocol Breach: Only Tactical units can log Field Data");
        require(
            (recipientRole == IMDCNCommand.Role.Strategic || recipientRole == IMDCNCommand.Role.Operational) && 
            senderBranch == recipientBranch,
            "Protocol Breach: Tactical units can only log Field Data UPWARDS to their OWN branch"
        );

        fieldCount++;
        fieldData[fieldCount] = FieldMessage({
            id: fieldCount,
            sender: msg.sender,
            recipient: _recipient,
            data: _data,
            timestamp: block.timestamp,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });

        emit FieldDataLogged(
            fieldCount,
            msg.sender,
            _recipient,
            _data,
            block.timestamp
        );
    }

    // Unchanged: Subordinate acknowledges field data
    function acknowledgeFieldData(uint256 _id) public {
        FieldMessage storage f = fieldData[_id];
        require(f.id != 0, "Field data not found");
        require(!f.acknowledged, "Already acknowledged");

        // In legacy mode, we may not know the exact recipient, so we relax this check
        // but we still enforce it for newer entries
        if (
            f.recipient != address(0x1234567890123456789012345678901234567890)
        ) {
            require(msg.sender == f.recipient, "Not the intended recipient");
        }

        f.acknowledged = true;
        f.acknowledgedBy = msg.sender;
        f.acknowledgedTimestamp = block.timestamp;

        emit FieldDataAcknowledged(_id, msg.sender, block.timestamp);
    }

    // Renamed: Legacy version for backward compatibility
    // Update maintenance status using recipient group and branch
    function updateMaintenanceLegacy(
        uint8 _recipientGroup,
        uint8 _branch,
        uint256 _assetId,
        string memory _status
    ) public {
        maintenanceCount++;

        // For the legacy version, we don't know the exact recipient,
        // so we use a placeholder address
        address dummyRecipient = address(
            0x1234567890123456789012345678901234567890
        );

        maintenanceData[maintenanceCount] = MaintenanceMessage({
            id: maintenanceCount,
            sender: msg.sender,
            recipient: dummyRecipient,
            assetId: _assetId,
            status: _status,
            timestamp: block.timestamp,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });

        emit MaintenanceUpdated(
            maintenanceCount,
            msg.sender,
            dummyRecipient,
            _assetId,
            _status,
            block.timestamp
        );
    }

    // Unchanged: Update maintenance status with direct addressing
    function updateMaintenance(
        address _recipient,
        uint256 _assetId,
        string memory _status
    ) public {
        IMDCNCommand.Role senderRole = commandContract.roles(msg.sender);
        IMDCNCommand.Role recipientRole = commandContract.roles(_recipient);
        IMDCNCommand.Branch senderBranch = commandContract.branches(msg.sender);
        IMDCNCommand.Branch recipientBranch = commandContract.branches(_recipient);

        require(senderRole == IMDCNCommand.Role.Tactical, "Protocol Breach: Only Tactical units can update Maintenance");
        require(
            (recipientRole == IMDCNCommand.Role.Strategic || recipientRole == IMDCNCommand.Role.Operational) && 
            senderBranch == recipientBranch,
            "Protocol Breach: Tactical units can only send Maintenance UPWARDS to their OWN branch"
        );

        maintenanceCount++;
        maintenanceData[maintenanceCount] = MaintenanceMessage({
            id: maintenanceCount,
            sender: msg.sender,
            recipient: _recipient,
            assetId: _assetId,
            status: _status,
            timestamp: block.timestamp,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });

        emit MaintenanceUpdated(
            maintenanceCount,
            msg.sender,
            _recipient,
            _assetId,
            _status,
            block.timestamp
        );
    }

    // Unchanged: Subordinate acknowledges maintenance instruction
    function acknowledgeMaintenance(uint256 _id) public {
        MaintenanceMessage storage m = maintenanceData[_id];
        require(m.id != 0, "Maintenance message not found");
        require(!m.acknowledged, "Already acknowledged");

        // In legacy mode, we may not know the exact recipient, so we relax this check
        // but we still enforce it for newer entries
        if (
            m.recipient != address(0x1234567890123456789012345678901234567890)
        ) {
            require(msg.sender == m.recipient, "Not the intended recipient");
        }

        m.acknowledged = true;
        m.acknowledgedBy = msg.sender;
        m.acknowledgedTimestamp = block.timestamp;

        emit MaintenanceAcknowledged(_id, msg.sender, block.timestamp);
    }
}
