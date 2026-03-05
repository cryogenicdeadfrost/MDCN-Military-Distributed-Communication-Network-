// src/pages/SubordinateDashboard.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const SubordinateDashboard = ({ contracts, account, userRole, adminAddresses }) => {
  const [commands, setCommands] = useState([]);
  const [intelMessages, setIntelMessages] = useState([]);
  const [fieldData, setFieldData] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [sentFieldData, setSentFieldData] = useState([]);
  const [sentIntelData, setSentIntelData] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('commands');
  const [responseText, setResponseText] = useState('');
  const [respondingToId, setRespondingToId] = useState(null);
  const [selectedAdminIndex, setSelectedAdminIndex] = useState(0);
  const [selectedSubordinateIndex, setSelectedSubordinateIndex] = useState(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [newMessageType, setNewMessageType] = useState('intel'); // 'intel' or 'field'
  const [messageSending, setMessageSending] = useState(false);
  const [userBranch, setUserBranch] = useState('1'); // Default: Army

  // Determine active theme based on branch
  const getThemeClass = (branchId) => {
    switch (parseInt(branchId)) {
      case 1: return "theme-army";
      case 2: return "theme-navy";
      case 3: return "theme-airforce";
      default: return "";
    }
  };

  // Role definitions matching the contract
  const ROLES = {
    NONE: 0,
    STRATEGIC: 1,  // Admin
    OPERATIONAL: 2,
    TACTICAL: 3
  };

  // Get role name based on role ID
  const getRoleName = (role) => {
    switch (Number(role)) {
      case 1: return "Strategic Command";
      case 2: return "Operational Command";
      case 3: return "Tactical Unit";
      default: return "Unknown";
    }
  };

  // Get position title based on address and role
  const getPositionTitle = (address, roleNum) => {
    const role = Number(roleNum);
    const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    if (role === 1) {
      return `Strategic Commander (${shortAddress})`;
    } else if (role === 2) {
      return `Operational Officer (${shortAddress})`;
    } else if (role === 3) {
      return `Field Operative (${shortAddress})`;
    } else {
      return `Unknown (${shortAddress})`;
    }
  };

  // Get branch name based on branch ID
  const getBranchName = (branch) => {
    switch (parseInt(branch)) {
      case 1: return "Army";
      case 2: return "Navy";
      case 3: return "Air Force";
      default: return "None";
    }
  };

  // Get recipient group name based on ID
  const getRecipientGroupName = (group) => {
    switch (parseInt(group)) {
      case 1: return "Command Center";
      case 2: return "Tactical Command";
      case 3: return "Coordination Command";
      case 4: return "Intelligence Command";
      default: return "None";
    }
  };

  // Format timestamp to a readable date
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Extract metadata from a message
  const extractMetadata = (message) => {
    const branchMatch = message.match(/\[Branch: (\d+)/);
    const groupMatch = message.match(/Group: (\d+)\]/);
    const branch = branchMatch ? branchMatch[1] : null;
    const group = groupMatch ? groupMatch[1] : null;
    let cleanMessage = message;
    if (branchMatch && groupMatch) {
      cleanMessage = message.replace(/\[Branch: \d+, Group: \d+\] /, '');
    }
    return { branch, group, cleanMessage };
  };

  // Set user's branch based on the account (demo logic)
  useEffect(() => {
    if (account) {
      const lastChar = account.slice(-1);
      const lastDigit = parseInt(lastChar, 16) % 3;
      setUserBranch((lastDigit + 1).toString());
    }
  }, [account]);

  // Find all subordinates for direct messaging
  const findSubordinates = async () => {
    if (!contracts.commandContract) return;
    try {
      const filter = contracts.commandContract.filters.RoleAssigned();
      const events = await contracts.commandContract.queryFilter(filter);
      const subordinateList = [];
      for (const event of events) {
        const { account: addr, role } = event.args;
        const roleNum = Number(role);
        if (roleNum > 0 && roleNum !== 1 && addr.toLowerCase() !== account.toLowerCase()) {
          if (!subordinateList.some(sub => sub.address.toLowerCase() === addr.toLowerCase())) {
            subordinateList.push({
              address: addr,
              role: roleNum,
              name: getPositionTitle(addr, roleNum)
            });
          }
        }
      }
      setSubordinates(subordinateList);
    } catch (error) {
      console.error("Error finding subordinates:", error);
    }
  };

  // Find the appropriate admin recipient based on the sender's role
  const findAppropriateRecipient = async (sender) => {
    if (!contracts.commandContract) return null;
    try {
      if (adminAddresses && adminAddresses.length > 0) {
        return adminAddresses[selectedAdminIndex];
      }
      const senderRole = await contracts.commandContract.roles(sender);
      if (Number(senderRole) === ROLES.STRATEGIC) {
        return sender;
      }
      const roleFilter = contracts.commandContract.filters.RoleAssigned(null, ROLES.STRATEGIC);
      const roleEvents = await contracts.commandContract.queryFilter(roleFilter);
      if (roleEvents.length > 0) {
        return roleEvents[0].args.account;
      }
      return sender;
    } catch (error) {
      console.error("Error finding appropriate recipient:", error);
      return sender;
    }
  };

  // Data fetching functions
  const fetchCommands = async () => {
    try {
      const commandContract = contracts.commandContract;
      const filter = commandContract.filters.CommandSent();
      const events = await commandContract.queryFilter(filter);
      const processedCommands = await Promise.all(
        events.map(async (event) => {
          const { id, sender, recipientGroup, branch, layer, commandText, timestamp } = event.args;
          const commandLayer = parseInt(layer.toString());
          const userRoleValue = parseInt(userRole);
          if (commandLayer <= userRoleValue && commandLayer < userRoleValue) {
            const command = await commandContract.commands(id);
            let senderRole;
            try {
              senderRole = await commandContract.roles(sender);
            } catch (error) {
              senderRole = 0;
            }
            return {
              id: id.toString(),
              sender,
              senderRole: senderRole.toString(),
              recipientGroup: recipientGroup.toString(),
              branch: branch.toString(),
              layer: layer.toString(),
              commandText,
              timestamp: timestamp.toString(),
              acknowledged: command.acknowledged,
              executed: command.executed,
              senderPosition: getPositionTitle(sender, senderRole)
            };
          }
          return null;
        })
      );
      const filteredCommands = processedCommands
        .filter((cmd) => cmd !== null)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      setCommands(filteredCommands);
    } catch (error) {
      console.error("Error fetching commands:", error);
    }
  };

  const fetchIntelligence = async () => {
    try {
      const coordinationContract = contracts.coordinationContract;
      const filter = coordinationContract.filters.IntelligenceSynced();
      const events = await coordinationContract.queryFilter(filter);
      const processedIntel = await Promise.all(
        events.map(async (event) => {
          const { id, sender, recipient, data, timestamp } = event.args;
          let senderRole;
          try {
            senderRole = await contracts.commandContract.roles(sender);
          } catch (error) {
            senderRole = 0;
          }
          let acknowledged = false;
          try {
            const intel = await coordinationContract.intelStore(id);
            acknowledged = intel.acknowledged;
          } catch (error) {
            console.error("Error checking acknowledgment:", error);
          }
          const { branch, group, cleanMessage } = extractMetadata(data);
          return {
            id: id.toString(),
            sender,
            senderRole: senderRole.toString(),
            recipient,
            data,
            message: cleanMessage || data,
            branch,
            group,
            timestamp: timestamp.toString(),
            acknowledged,
            isSender: sender.toLowerCase() === account.toLowerCase(),
            isRecipient: recipient.toLowerCase() === account.toLowerCase(),
            isResponse: data.includes("RESPONSE TO")
          };
        })
      );
      const receivedIntel = processedIntel
        .filter((intel) => intel.isRecipient)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      const sent = processedIntel
        .filter((intel) => intel.isSender)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      setIntelMessages(receivedIntel);
      setSentIntelData(sent);
    } catch (error) {
      console.error("Error fetching intelligence:", error);
    }
  };

  const fetchFieldData = async () => {
    try {
      const tacticalContract = contracts.tacticalContract;
      const filter = tacticalContract.filters.FieldDataLogged();
      const events = await tacticalContract.queryFilter(filter);
      const processedData = await Promise.all(
        events.map(async (event) => {
          const { id, sender, recipient, data, timestamp } = event.args;
          let senderRole;
          try {
            senderRole = await contracts.commandContract.roles(sender);
          } catch (error) {
            senderRole = 0;
          }
          let acknowledged = false;
          try {
            const fieldDataRecord = await tacticalContract.fieldData(id);
            acknowledged = fieldDataRecord.acknowledged;
          } catch (error) {
            console.error("Error checking acknowledgment:", error);
          }
          const { branch, group, cleanMessage } = extractMetadata(data);
          return {
            id: id.toString(),
            sender,
            senderRole: senderRole.toString(),
            recipient,
            data,
            message: cleanMessage || data,
            branch,
            group,
            timestamp: timestamp.toString(),
            acknowledged,
            isSender: sender.toLowerCase() === account.toLowerCase(),
            isRecipient: recipient.toLowerCase() === account.toLowerCase(),
            isResponse: data.includes("RESPONSE TO")
          };
        })
      );
      const receivedData = processedData
        .filter((data) => data.isRecipient)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      const sentData = processedData
        .filter((data) => data.isSender)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      setFieldData(receivedData);
      setSentFieldData(sentData);
    } catch (error) {
      console.error("Error fetching field data:", error);
    }
  };

  const fetchMaintenanceData = async () => {
    try {
      const tacticalContract = contracts.tacticalContract;
      const filter = tacticalContract.filters.MaintenanceUpdated();
      const events = await tacticalContract.queryFilter(filter);
      const processedData = await Promise.all(
        events.map(async (event) => {
          const { id, sender, recipient, assetId, status, timestamp } = event.args;
          if (recipient.toLowerCase() === account.toLowerCase()) {
            let senderRole;
            try {
              senderRole = await contracts.commandContract.roles(sender);
            } catch (error) {
              senderRole = 0;
            }
            let acknowledged = false;
            try {
              const maintenanceRecord = await tacticalContract.maintenanceData(id);
              acknowledged = maintenanceRecord.acknowledged;
            } catch (error) {
              console.error("Error checking acknowledgment:", error);
            }
            return {
              id: id.toString(),
              sender,
              senderRole: senderRole.toString(),
              recipient,
              assetId: assetId.toString(),
              status,
              timestamp: timestamp.toString(),
              acknowledged,
            };
          }
          return null;
        })
      );
      const sortedData = processedData
        .filter((data) => data !== null)
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      setMaintenanceData(sortedData);
    } catch (error) {
      console.error("Error fetching maintenance data:", error);
    }
  };

  const acknowledgeCommand = async (commandId) => {
    try {
      const tx = await contracts.commandContract.acknowledgeCommand(commandId);
      await tx.wait();
      fetchCommands();
    } catch (error) {
      console.error("Error acknowledging command:", error);
      alert("Failed to acknowledge command. Check console for details.");
    }
  };

  const acknowledgeIntelligence = async (intelId) => {
    try {
      const tx = await contracts.coordinationContract.acknowledgeIntelligence(intelId);
      await tx.wait();
      fetchIntelligence();
    } catch (error) {
      console.error("Error acknowledging intelligence:", error);
      alert("Failed to acknowledge intelligence. Check console for details.");
    }
  };

  const acknowledgeFieldData = async (dataId) => {
    try {
      const tx = await contracts.tacticalContract.acknowledgeFieldData(dataId);
      await tx.wait();
      fetchFieldData();
    } catch (error) {
      console.error("Error acknowledging field data:", error);
      alert("Failed to acknowledge field data. Check console for details.");
    }
  };

  const acknowledgeMaintenance = async (maintenanceId) => {
    try {
      const tx = await contracts.tacticalContract.acknowledgeMaintenance(maintenanceId);
      await tx.wait();
      fetchMaintenanceData();
    } catch (error) {
      console.error("Error acknowledging maintenance:", error);
      alert("Failed to acknowledge maintenance. Check console for details.");
    }
  };

  // Responding to a command
  const startRespondingTo = (id) => {
    setRespondingToId(id);
    setResponseText('');
  };

  const cancelResponse = () => {
    setRespondingToId(null);
    setResponseText('');
  };

  const sendResponse = async (commandId) => {
    if (!responseText.trim()) {
      alert("Please enter a response message.");
      return;
    }
    try {
      const command = commands.find((cmd) => cmd.id === commandId);
      if (!command) {
        throw new Error("Command not found");
      }
      console.log("Sending response to command:", commandId);
      const recipientAddress = await findAppropriateRecipient(command.sender);
      console.log("Recipient address (admin):", recipientAddress);
      console.log("Response text:", responseText);
      const metadataPrefix = `[Branch: ${userBranch}, Group: ${userRole}] `;
      const messageData = `RESPONSE TO CMD #${commandId}: ${metadataPrefix}${responseText}`;
      const tx = await contracts.coordinationContract.syncIntelligence(recipientAddress, messageData);
      await tx.wait();
      if (!command.acknowledged) {
        await acknowledgeCommand(commandId);
        console.log("Command acknowledged");
      }
      setRespondingToId(null);
      setResponseText('');
      fetchIntelligence();
      alert("Response sent successfully to admin!");
    } catch (error) {
      console.error("Error sending response:", error);
      let errorMessage = error.reason || error.message || "Unknown error";

      if (errorMessage.includes("Protocol Breach:")) {
        const breachMatch = errorMessage.match(/Protocol Breach: ([^"]+)/);
        if (breachMatch) {
          alert(`BLOCKED: Protocol Breach\n\n${breachMatch[1]}`);
          return;
        }
      }

      if (errorMessage.includes("user denied")) {
        alert("Transaction was rejected in your wallet.");
      } else if (errorMessage.includes("insufficient funds")) {
        alert("Your wallet doesn't have enough ETH for gas fees.");
      } else {
        alert(`Failed to send response: ${errorMessage}`);
      }
    }
  };

  // -------------------------------
  // NEW: Define sendNewMessage BEFORE use in renderNewMessageSection
  // -------------------------------
  const sendNewMessage = async () => {
    if (!newMessageText.trim()) {
      alert("Please enter a message.");
      return;
    }
    if (selectedSubordinateIndex === null && selectedAdminIndex === null) {
      alert("Please select a recipient.");
      return;
    }
    setMessageSending(true);
    try {
      const metadataPrefix = `[Branch: ${userBranch}, Group: ${userRole}] `;
      const messageData = `${metadataPrefix}${newMessageText}`;
      let recipientAddress;
      if (selectedSubordinateIndex !== null) {
        recipientAddress = subordinates[selectedSubordinateIndex].address;
      } else {
        recipientAddress = adminAddresses[selectedAdminIndex];
      }
      console.log("Sending message to:", recipientAddress);
      console.log("Message type:", newMessageType);
      let tx;
      if (newMessageType === 'intel') {
        tx = await contracts.coordinationContract.syncIntelligence(recipientAddress, messageData);
      } else {
        tx = await contracts.tacticalContract.logFieldData(recipientAddress, messageData);
      }
      await tx.wait();
      setNewMessageText('');
      setMessageSending(false);
      if (newMessageType === 'intel') {
        fetchIntelligence();
      } else {
        fetchFieldData();
      }
      alert("Message sent successfully!");
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageSending(false);
      let errorMessage = error.reason || error.message || "Unknown error";

      if (errorMessage.includes("Protocol Breach:")) {
        const breachMatch = errorMessage.match(/Protocol Breach: ([^"]+)/);
        if (breachMatch) {
          alert(`BLOCKED: Protocol Breach\n\n${breachMatch[1]}`);
          return;
        }
      }

      alert(`Error: ${errorMessage}`);
    }
  };

  // -------------------------------
  // Render Compose New Message Section
  // -------------------------------
  const renderNewMessageSection = () => {
    return (
      <div className="new-message-section">
        <h2>Compose New Message</h2>
        <div className="compose-row">
          <div className="form-control">
            <label>Admin Recipient</label>
            <select
              value={selectedAdminIndex}
              onChange={(e) => setSelectedAdminIndex(Number(e.target.value))}
            >
              {adminAddresses &&
                adminAddresses.map((addr, index) => (
                  <option key={index} value={index}>
                    {addr}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-control">
            <label>Subordinate Recipient</label>
            <select
              value={selectedSubordinateIndex !== null ? selectedSubordinateIndex : ""}
              onChange={(e) => setSelectedSubordinateIndex(Number(e.target.value))}
            >
              <option value="">Select subordinate</option>
              {subordinates &&
                subordinates.map((sub, index) => (
                  <option key={index} value={index}>
                    {sub.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="compose-row">
          <div className="form-control">
            <label>Message Type</label>
            <select
              value={newMessageType}
              onChange={(e) => setNewMessageType(e.target.value)}
            >
              <option value="intel">Intelligence</option>
              <option value="field">Field Data</option>
            </select>
          </div>
        </div>

        <div className="compose-row">
          <div className="form-control">
            <label>Your Message</label>
            <textarea
              rows={6}
              placeholder="Type your detailed message here..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
            ></textarea>
          </div>
        </div>

        <div className="compose-actions">
          <button
            className="btn submit-btn"
            onClick={sendNewMessage}
            disabled={messageSending}
          >
            {messageSending ? "Sending..." : "Send Message"}
          </button>
        </div>
      </div>
    );
  };

  // Main useEffect for fetching data and setting up event listeners
  useEffect(() => {
    if (
      contracts.commandContract &&
      contracts.coordinationContract &&
      contracts.tacticalContract
    ) {
      const fetchAllData = async () => {
        setLoading(true);
        await findSubordinates();
        await Promise.all([
          fetchCommands(),
          fetchIntelligence(),
          fetchFieldData(),
          fetchMaintenanceData()
        ]);
        setLoading(false);
      };
      fetchAllData();

      const commandContract = contracts.commandContract;
      const commandSentFilter = commandContract.filters.CommandSent();
      const commandAckFilter = commandContract.filters.CommandAcknowledged();
      commandContract.on(commandSentFilter, () => fetchCommands());
      commandContract.on(commandAckFilter, () => fetchCommands());

      const coordinationContract = contracts.coordinationContract;
      const intelSyncedFilter = coordinationContract.filters.IntelligenceSynced();
      const intelAckFilter = coordinationContract.filters.IntelligenceAcknowledged();
      coordinationContract.on(intelSyncedFilter, () => fetchIntelligence());
      coordinationContract.on(intelAckFilter, () => fetchIntelligence());

      const tacticalContract = contracts.tacticalContract;
      const fieldDataFilter = tacticalContract.filters.FieldDataLogged();
      const fieldDataAckFilter = tacticalContract.filters.FieldDataAcknowledged();
      const maintenanceFilter = tacticalContract.filters.MaintenanceUpdated();
      const maintenanceAckFilter = tacticalContract.filters.MaintenanceAcknowledged();
      tacticalContract.on(fieldDataFilter, () => fetchFieldData());
      tacticalContract.on(fieldDataAckFilter, () => fetchFieldData());
      tacticalContract.on(maintenanceFilter, () => fetchMaintenanceData());
      tacticalContract.on(maintenanceAckFilter, () => fetchMaintenanceData());

      return () => {
        commandContract.removeAllListeners(commandSentFilter);
        commandContract.removeAllListeners(commandAckFilter);
        coordinationContract.removeAllListeners(intelSyncedFilter);
        coordinationContract.removeAllListeners(intelAckFilter);
        tacticalContract.removeAllListeners(fieldDataFilter);
        tacticalContract.removeAllListeners(fieldDataAckFilter);
        tacticalContract.removeAllListeners(maintenanceFilter);
        tacticalContract.removeAllListeners(maintenanceAckFilter);
      };
    }
  }, [contracts, account]);

  return (
    <div className={`subordinate-dashboard ${getThemeClass(userBranch)}`}>
      <div className="dashboard-header">
        <h1>Field Operations Dashboard</h1>
        <div className="user-info">
          <p>
            <strong>Account:</strong> {account.substring(0, 6)}...
            {account.substring(account.length - 4)}
          </p>
          <p>
            <strong>Role:</strong> {getRoleName(userRole)}
          </p>
          <p>
            <strong>Branch:</strong> {getBranchName(userBranch)}
          </p>
        </div>
      </div>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${selectedTab === "commands" ? "active" : ""}`}
          onClick={() => setSelectedTab("commands")}
        >
          Commands
        </button>
        <button
          className={`tab-btn ${selectedTab === "intelligence" ? "active" : ""}`}
          onClick={() => setSelectedTab("intelligence")}
        >
          Intelligence
        </button>
        <button
          className={`tab-btn ${selectedTab === "field-data" ? "active" : ""}`}
          onClick={() => setSelectedTab("field-data")}
        >
          Field Data
        </button>
        <button
          className={`tab-btn ${selectedTab === "maintenance" ? "active" : ""}`}
          onClick={() => setSelectedTab("maintenance")}
        >
          Maintenance
        </button>
        <button
          className={`tab-btn ${selectedTab === "sent-data" ? "active" : ""}`}
          onClick={() => setSelectedTab("sent-data")}
        >
          Sent Data
        </button>
        <button
          className={`tab-btn ${selectedTab === "new-message" ? "active" : ""}`}
          onClick={() => setSelectedTab("new-message")}
        >
          New Message
        </button>
      </div>

      <div className="dashboard-content">
        {loading ? (
          <div className="loading">Loading data...</div>
        ) : (
          <>
            {selectedTab === "commands" && (
              <div className="commands-section">
                <h2>Command Center</h2>
                {commands.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Branch</th>
                        <th>Command</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commands.map((cmd) => (
                        <React.Fragment key={cmd.id}>
                          <tr className={cmd.acknowledged ? "acknowledged" : ""}>
                            <td>{cmd.id}</td>
                            <td>{cmd.senderPosition}</td>
                            <td>{getRecipientGroupName(cmd.recipientGroup)}</td>
                            <td>{getBranchName(cmd.branch)}</td>
                            <td>{cmd.commandText}</td>
                            <td>{formatDate(cmd.timestamp)}</td>
                            <td>
                              {cmd.acknowledged ? (
                                <>
                                  Acknowledged
                                  <br />
                                  <span className="immutable-tag">Immutable</span>
                                </>
                              ) : "Pending"}
                            </td>
                            <td>
                              {!cmd.acknowledged && (
                                <button
                                  className="btn btn-small"
                                  onClick={() => acknowledgeCommand(cmd.id)}
                                >
                                  Acknowledge
                                </button>
                              )}
                              <button
                                className="btn btn-small response-btn"
                                onClick={() => startRespondingTo(cmd.id)}
                                style={{ marginLeft: "5px" }}
                              >
                                Respond
                              </button>
                            </td>
                          </tr>
                          {respondingToId === cmd.id && (
                            <tr className="response-row">
                              <td colSpan="8">
                                <div className="response-form">
                                  <h4>Responding to Command #{cmd.id}</h4>
                                  <textarea
                                    rows="3"
                                    placeholder="Type your response here..."
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    className="response-textarea"
                                  ></textarea>
                                  <div className="response-buttons">
                                    <button
                                      className="btn btn-small cancel-btn"
                                      onClick={cancelResponse}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      className="btn btn-small submit-btn"
                                      onClick={() => sendResponse(cmd.id)}
                                    >
                                      Send Response
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No commands found.</div>
                )}
              </div>
            )}

            {selectedTab === "intelligence" && (
              <div className="intelligence-section">
                <h2>Intelligence Reports</h2>
                {intelMessages.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>From</th>
                        <th>Branch</th>
                        <th>Group</th>
                        <th>Data</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intelMessages.map((intel) => (
                        <tr key={intel.id} className={intel.acknowledged ? "acknowledged" : ""}>
                          <td>{intel.id}</td>
                          <td>{getPositionTitle(intel.sender, intel.senderRole)}</td>
                          <td>{intel.branch ? getBranchName(intel.branch) : 'N/A'}</td>
                          <td>{intel.group ? getRecipientGroupName(intel.group) : 'N/A'}</td>
                          <td>{intel.message}</td>
                          <td>{formatDate(intel.timestamp)}</td>
                          <td>
                            {intel.acknowledged ? (
                              <>
                                Acknowledged
                                <br />
                                <span className="immutable-tag">Immutable</span>
                              </>
                            ) : "Pending"}
                          </td>
                          <td>
                            {!intel.acknowledged && (
                              <button
                                className="btn btn-small"
                                onClick={() => acknowledgeIntelligence(intel.id)}
                              >
                                Acknowledge
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No intelligence reports found.</div>
                )}
              </div>
            )}

            {selectedTab === "field-data" && (
              <div className="field-data-section">
                <h2>Field Data Logs</h2>
                {fieldData.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>From</th>
                        <th>Branch</th>
                        <th>Group</th>
                        <th>Data</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldData.map((data) => (
                        <tr key={data.id} className={data.acknowledged ? "acknowledged" : ""}>
                          <td>{data.id}</td>
                          <td>{getPositionTitle(data.sender, data.senderRole)}</td>
                          <td>{data.branch ? getBranchName(data.branch) : "N/A"}</td>
                          <td>{data.group ? getRecipientGroupName(data.group) : "N/A"}</td>
                          <td>{data.message}</td>
                          <td>{formatDate(data.timestamp)}</td>
                          <td>
                            {data.acknowledged ? (
                              <>
                                Acknowledged
                                <br />
                                <span className="immutable-tag">Immutable</span>
                              </>
                            ) : "Pending"}
                          </td>
                          <td>
                            {!data.acknowledged && (
                              <button
                                className="btn btn-small"
                                onClick={() => acknowledgeFieldData(data.id)}
                              >
                                Acknowledge
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No field data logs found.</div>
                )}
              </div>
            )}

            {selectedTab === "maintenance" && (
              <div className="maintenance-section">
                <h2>Maintenance Updates</h2>
                {maintenanceData.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>From</th>
                        <th>Asset ID</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenanceData.map((item) => (
                        <tr key={item.id} className={item.acknowledged ? "acknowledged" : ""}>
                          <td>{item.id}</td>
                          <td>{getPositionTitle(item.sender, item.senderRole)}</td>
                          <td>{item.assetId}</td>
                          <td>{item.status}</td>
                          <td>{formatDate(item.timestamp)}</td>
                          <td>
                            {item.acknowledged ? (
                              <>
                                Acknowledged
                                <br />
                                <span className="immutable-tag">Immutable</span>
                              </>
                            ) : (
                              <button
                                className="btn btn-small"
                                onClick={() => acknowledgeMaintenance(item.id)}
                              >
                                Acknowledge
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No maintenance updates found.</div>
                )}
              </div>
            )}

            {selectedTab === "sent-data" && (
              <div className="sent-data-section">
                <h2>Sent Data</h2>
                <h3>Sent Intelligence</h3>
                {sentIntelData.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>To</th>
                        <th>Data</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentIntelData.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.recipient}</td>
                          <td>{item.message}</td>
                          <td>{formatDate(item.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No sent intelligence found.</div>
                )}
                <h3>Sent Field Data</h3>
                {sentFieldData.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>To</th>
                        <th>Data</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentFieldData.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.recipient}</td>
                          <td>{item.message}</td>
                          <td>{formatDate(item.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No sent field data found.</div>
                )}
              </div>
            )}

            {selectedTab === "new-message" && renderNewMessageSection()}
          </>
        )}
      </div>
    </div>
  );
};

export default SubordinateDashboard;
