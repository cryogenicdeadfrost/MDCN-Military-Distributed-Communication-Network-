// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMDCNCommand {
    enum Role { None, Strategic, Operational, Tactical }
    enum Branch { None, Army, Navy, AirForce }
    function roles(address) external view returns (Role);
    function branches(address) external view returns (Branch);
}

contract MDCNCoordination {
    IMDCNCommand public commandContract;

    constructor(address _commandContractAddress) {
        commandContract = IMDCNCommand(_commandContractAddress);
    }
    struct IntelMessage {
        uint256 id;
        address sender;
        address recipient; // The intended receiver
        string intelData;
        uint256 timestamp;
        bool acknowledged;
        address acknowledgedBy;
        uint256 acknowledgedTimestamp;
    }
    uint256 public intelCount;
    mapping(uint256 => IntelMessage) public intelStore;

    event IntelligenceSynced(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        string data,
        uint256 timestamp
    );

    event IntelligenceAcknowledged(
        uint256 indexed id,
        address indexed acknowledgedBy,
        uint256 timestamp
    );

    /**
     * @notice Legacy function to sync intelligence via group and branch
     * @dev This function is provided for backward compatibility.
     * @param _recipientGroup The recipient group identifier.
     * @param _branch The branch identifier.
     * @param _data The intelligence data.
     */
    function syncIntelligenceLegacy(
        uint8 _recipientGroup,
        uint8 _branch,
        string memory _data
    ) public {
        intelCount++;
        // In legacy mode, we do not know the exact recipient – so we use a dummy address.
        address dummyRecipient = address(
            0x1234567890123456789012345678901234567890
        );
        intelStore[intelCount] = IntelMessage({
            id: intelCount,
            sender: msg.sender,
            recipient: dummyRecipient,
            intelData: _data,
            timestamp: block.timestamp,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });
        emit IntelligenceSynced(
            intelCount,
            msg.sender,
            dummyRecipient,
            _data,
            block.timestamp
        );
    }

    /**
     * @notice New function to sync intelligence using a specified recipient address.
     * @param _recipient The address of the intended recipient.
     * @param _data The intelligence data.
     */
    function syncIntelligence(address _recipient, string memory _data) public {
        IMDCNCommand.Role senderRole = commandContract.roles(msg.sender);
        IMDCNCommand.Role recipientRole = commandContract.roles(_recipient);
        IMDCNCommand.Branch senderBranch = commandContract.branches(msg.sender);
        IMDCNCommand.Branch recipientBranch = commandContract.branches(_recipient);

        require(senderRole != IMDCNCommand.Role.None, "Protocol Breach: Sender has no role");
        require(recipientRole != IMDCNCommand.Role.None, "Protocol Breach: Recipient does not exist");

        if (senderRole == IMDCNCommand.Role.Tactical) {
            // Tactical strictly reports UP to their own branch
            require(
                (recipientRole == IMDCNCommand.Role.Strategic || recipientRole == IMDCNCommand.Role.Operational) && 
                senderBranch == recipientBranch,
                "Protocol Breach: Tactical can only sync intelligence UPWARDS to their OWN branch"
            );
        } else if (senderRole == IMDCNCommand.Role.Operational) {
            // Operational reports UP to their own branch, or LATERALLY to any Operational branch, or DOWN to their own branch
            require(
                (recipientRole == IMDCNCommand.Role.Strategic && senderBranch == recipientBranch) ||
                (recipientRole == IMDCNCommand.Role.Operational) ||
                (recipientRole == IMDCNCommand.Role.Tactical && senderBranch == recipientBranch),
                "Protocol Breach: Operational intel sync unauthorized"
            );
        } else if (senderRole == IMDCNCommand.Role.Strategic) {
            // Strategic reports DOWN to their own branch, or LATERALLY to any Strategic branch
            require(
                (recipientRole == IMDCNCommand.Role.Operational && senderBranch == recipientBranch) ||
                (recipientRole == IMDCNCommand.Role.Strategic) ||
                (recipientRole == IMDCNCommand.Role.Tactical && senderBranch == recipientBranch),
                "Protocol Breach: Strategic intel sync unauthorized"
            );
        }

        intelCount++;
        intelStore[intelCount] = IntelMessage({
            id: intelCount,
            sender: msg.sender,
            recipient: _recipient,
            intelData: _data,
            timestamp: block.timestamp,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });
        emit IntelligenceSynced(
            intelCount,
            msg.sender,
            _recipient,
            _data,
            block.timestamp
        );
    }

    /**
     * @notice Acknowledge receipt of an intelligence message.
     * @param _intelId The identifier of the intelligence message.
     */
    function acknowledgeIntelligence(uint256 _intelId) public {
        IntelMessage storage intel = intelStore[_intelId];
        require(intel.id != 0, "Intel not found");
        require(!intel.acknowledged, "Already acknowledged");
        // For legacy entries, relax the requirement if we use the dummy address.
        if (
            intel.recipient !=
            address(0x1234567890123456789012345678901234567890)
        ) {
            require(msg.sender == intel.recipient, "Not the recipient");
        }
        intel.acknowledged = true;
        intel.acknowledgedBy = msg.sender;
        intel.acknowledgedTimestamp = block.timestamp;
        emit IntelligenceAcknowledged(_intelId, msg.sender, block.timestamp);
    }
}
