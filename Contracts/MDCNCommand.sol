// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MDCNCommand {
    // Define roles: 0 = None, 1 = Strategic (Admin), 2 = Operational, 3 = Tactical.
    enum Role {
        None,
        Strategic,
        Operational,
        Tactical
    }
    // Define recipient groups and branch enums (values passed as uint8 from frontend).
    enum RecipientGroup {
        None,
        CommandCenter,
        TacticalCommand,
        CoordinationCommand,
        IntelligenceCommand
    }
    enum Branch {
        None,
        Army,
        Navy,
        AirForce
    }
    struct Command {
        uint256 id;
        address sender;
        RecipientGroup recipientGroup;
        Branch branch;
        uint8 layer; // 1: Strategic, 2: Operational, 3: Tactical
        string commandText;
        uint256 timestamp;
        bool executed;
        bool acknowledged;
        address acknowledgedBy;
        uint256 acknowledgedTimestamp;
    }
    uint256 public commandCount;
    mapping(uint256 => Command) public commands;
    // Mapping from address to Role.
    mapping(address => Role) public roles;
    // Mapping from address to Branch.
    mapping(address => Branch) public branches;

    event CommandSent(
        uint256 indexed id,
        address indexed sender,
        uint8 recipientGroup,
        uint8 branch,
        uint8 layer,
        string commandText,
        uint256 timestamp
    );
    event CommandAcknowledged(
        uint256 indexed id,
        address indexed acknowledgedBy,
        uint256 timestamp
    );
    event RoleAssigned(address indexed account, Role role);

    constructor() {
        // The deployer is assigned as Strategic (the Admin role)
        roles[msg.sender] = Role.Strategic;
        branches[msg.sender] = Branch.Army; // Default branch for deployer
        emit RoleAssigned(msg.sender, Role.Strategic);
    }

    // Allow an admin to assign roles and branches to others.
    function assignRoleAndBranch(address _account, Role _role, Branch _branch) public {
        require(
            roles[msg.sender] == Role.Strategic,
            "Only Strategic (admin) can assign roles"
        );
        roles[_account] = _role;
        branches[_account] = _branch;
        emit RoleAssigned(_account, _role);
    }

    // Convenience function for the frontend/deployer
    function setRoleAndBranch(address _account, uint8 _roleId, uint8 _branchId) public {
        Role role = Role(_roleId);
        Branch branch = Branch(_branchId);
        assignRoleAndBranch(_account, role, branch);
    }

    // Send a command by specifying the command layer, recipient group, branch, and message.
    function sendCommand(
        uint8 _layer,
        uint8 _recipientGroup,
        uint8 _branch,
        string memory _commandText
    ) public {
        require(
            uint8(roles[msg.sender]) >= _layer,
            "Unauthorized: insufficient role"
        );
        commandCount++;
        commands[commandCount] = Command({
            id: commandCount,
            sender: msg.sender,
            recipientGroup: RecipientGroup(_recipientGroup),
            branch: Branch(_branch),
            layer: _layer,
            commandText: _commandText,
            timestamp: block.timestamp,
            executed: false,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });
        emit CommandSent(
            commandCount,
            msg.sender,
            _recipientGroup,
            _branch,
            _layer,
            _commandText,
            block.timestamp
        );
    }

    // Send a direct command to a specific address
    function sendDirectCommand(
        address _recipient,
        uint8 _layer,
        string memory _commandText
    ) public {
        require(
            uint8(roles[msg.sender]) >= _layer,
            "Unauthorized: insufficient role"
        );
        commandCount++;
        commands[commandCount] = Command({
            id: commandCount,
            sender: msg.sender,
            recipientGroup: RecipientGroup(0), // None, since we're using direct addressing
            branch: Branch(0), // None, since we're using direct addressing
            layer: _layer,
            commandText: _commandText,
            timestamp: block.timestamp,
            executed: false,
            acknowledged: false,
            acknowledgedBy: address(0),
            acknowledgedTimestamp: 0
        });

        // Still emit the same event but with placeholder values
        emit CommandSent(
            commandCount,
            msg.sender,
            0, // recipientGroup: None
            0, // branch: None
            _layer,
            _commandText,
            block.timestamp
        );
    }

    // Mark a command as acknowledged.
    function acknowledgeCommand(uint256 _commandId) public {
        Command storage cmd = commands[_commandId];
        require(cmd.id != 0, "Command does not exist");
        require(!cmd.acknowledged, "Already acknowledged");
        // In a real system you might check that msg.sender is the intended recipient.
        cmd.acknowledged = true;
        cmd.acknowledgedBy = msg.sender;
        cmd.acknowledgedTimestamp = block.timestamp;

        emit CommandAcknowledged(_commandId, msg.sender, block.timestamp);
    }

    // Mark a command as executed - admin only
    function executeCommand(uint256 _commandId) public {
        require(
            roles[msg.sender] == Role.Strategic,
            "Only Strategic can execute commands"
        );
        Command storage cmd = commands[_commandId];
        require(cmd.id != 0, "Command does not exist");
        require(!cmd.executed, "Already executed");

        cmd.executed = true;

        // If not already acknowledged, also mark as acknowledged
        if (!cmd.acknowledged) {
            cmd.acknowledged = true;
            cmd.acknowledgedBy = msg.sender;
            cmd.acknowledgedTimestamp = block.timestamp;
            emit CommandAcknowledged(_commandId, msg.sender, block.timestamp);
        }
    }
}
