// src/pages/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import Inbox from '../components/Inbox';
import { ethers } from 'ethers';

const AdminDashboard = ({ contract, contracts, account, isAdmin, contractAddresses }) => {
  // State variables
  const [selectedInbox, setSelectedInbox] = useState("1"); // Default: Main Command Centre
  const [commandResponses, setCommandResponses] = useState({});
  const [commands, setCommands] = useState([]);
  const [fieldDataMessages, setFieldDataMessages] = useState([]);
  const [intelligenceMessages, setIntelligenceMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("commands"); // Default tab
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [adminBranch, setAdminBranch] = useState("1"); // Default: Army

  // Map admin addresses to branches and inbox titles
  const adminBranches = {
    "1": "Army",
    "2": "Navy",
    "3": "Air Force"
  };
  const inboxTitles = {
    "1": "Main Command Centre",
    "2": "Tactical Command",
    "3": "Coordination Command",
    "4": "Intelligence Centre"
  };

  // Role definitions matching the contract

  const getRuntimeSigner = () => {
    if (contracts && contracts.signer) return contracts.signer;
    if (contract && contract.signer) return contract.signer;
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      return provider.getSigner();
    }
    return null;
  };

  const ROLES = {
    NONE: 0,
    STRATEGIC: 1,  // Admin
    OPERATIONAL: 2,
    TACTICAL: 3
  };

  // Get a concise position title for a given address using its role from the contract
  const getPositionTitle = async (address) => {
    if (!contract) return "Unknown";
    try {
      const role = await contract.roles(address);
      const roleNumber = Number(role.toString());
      const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
      if (roleNumber === 1) {
        return `Strategic Commander (${shortAddress})`;
      } else if (roleNumber === 2) {
        return `Operational Officer (${shortAddress})`;
      } else if (roleNumber === 3) {
        return `Field Operative (${shortAddress})`;
      } else {
        return `Unknown (${shortAddress})`;
      }
    } catch (error) {
      console.error("Error getting role:", error);
      return `Unknown (${address.substring(0, 6)}...${address.substring(address.length - 4)})`;
    }
  };

  // Convert a blockchain timestamp to a human-readable date
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  // Extract metadata (branch and group) from a message and return cleaned text
  const extractMetadata = (message) => {
    const branchMatch = message.match(/\[Branch: (\d+)/);
    const groupMatch = message.match(/Group: (\d+)\]/);
    const branch = branchMatch ? branchMatch[1] : null;
    const group = groupMatch ? groupMatch[1] : null;
    let cleanMessage = message;
    if (branchMatch && groupMatch) {
      cleanMessage = message.replace(/\[Branch: \d+, Group: \d+\] /, '');
    }
    return {
      branch,
      group,
      cleanMessage
    };
  };

  // Set adminBranch based on the last character of the account address (for demo purposes)
  useEffect(() => {
    if (account) {
      const lastChar = account.slice(-1);
      const lastDigit = parseInt(lastChar, 16) % 3;
      setAdminBranch((lastDigit + 1).toString());
    }
  }, [account]);

  // Fetch commands and their acknowledgment status from the contract
  const fetchCommands = async () => {
    if (!contract) return;
    try {
      const sentFilter = contract.filters.CommandSent();
      const sentEvents = await contract.queryFilter(sentFilter);
      const ackFilter = contract.filters.CommandAcknowledged();
      const ackEvents = await contract.queryFilter(ackFilter);
      const acknowledgments = {};
      for (const event of ackEvents) {
        const { id, acknowledgedBy, timestamp } = event.args;
        acknowledgments[id.toString()] = {
          acknowledgedBy,
          timestamp: timestamp.toString()
        };
      }
      const processedCommands = await Promise.all(sentEvents.map(async (event) => {
        const { id, sender, recipientGroup, branch, layer, commandText, timestamp } = event.args;
        const commandId = id.toString();
        const command = await contract.commands(commandId);
        const isAcknowledged = command.acknowledged;
        const acknowledgmentInfo = acknowledgments[commandId] || {};
        const senderPositionPromise = getPositionTitle(sender);
        let acknowledgedByPositionPromise = Promise.resolve(null);
        if (acknowledgmentInfo.acknowledgedBy) {
          acknowledgedByPositionPromise = getPositionTitle(acknowledgmentInfo.acknowledgedBy);
        }
        const [senderPosition, acknowledgedByPosition] = await Promise.all([
          senderPositionPromise,
          acknowledgedByPositionPromise
        ]);
        return {
          id: commandId,
          sender,
          senderPosition,
          recipientGroup: recipientGroup.toString(),
          branch: branch.toString(),
          layer: layer.toString(),
          commandText,
          timestamp: timestamp.toString(),
          acknowledged: isAcknowledged,
          executed: command.executed,
          acknowledgedBy: acknowledgmentInfo.acknowledgedBy || null,
          acknowledgedByPosition,
          acknowledgedTimestamp: acknowledgmentInfo.timestamp || null
        };
      }));
      const sortedCommands = processedCommands.sort((a, b) => 
        parseInt(b.timestamp) - parseInt(a.timestamp)
      );
      setCommands(sortedCommands);
    } catch (error) {
      console.error("Error fetching commands:", error);
    }
  };

  // Fetch intelligence (responses and general intel) via the coordination contract
  const fetchIntelligence = async () => {
    try {
      const signer = getRuntimeSigner();
      if (!contractAddresses.coordination || !signer) return;
      const coordABI = [
        "event IntelligenceSynced(uint256 indexed id, address indexed sender, address indexed recipient, string data, uint256 timestamp)",
        "function intelStore(uint256) public view returns (uint256 id, address sender, address recipient, string intelData, uint256 timestamp, bool acknowledged, address acknowledgedBy, uint256 acknowledgedTimestamp)"
      ];
      const coordContract = new ethers.Contract(
        contractAddresses.coordination,
        coordABI,
        signer
      );
      const filter = coordContract.filters.IntelligenceSynced(null, null, account);
      const events = await coordContract.queryFilter(filter);
      const responses = {};
      const generalIntelligence = [];
      for (const event of events) {
        const { id, sender, recipient, data, timestamp } = event.args;
        const senderPosition = await getPositionTitle(sender);
        let acknowledged = false;
        let acknowledgedBy = null;
        try {
          const intelInfo = await coordContract.intelStore(id);
          acknowledged = intelInfo.acknowledged;
          acknowledgedBy = intelInfo.acknowledgedBy;
        } catch (error) {
          console.error("Error getting intel status:", error);
        }
        const responseMatch = data.match(/RESPONSE TO CMD #(\d+):/);
        if (responseMatch) {
          const commandId = responseMatch[1];
          const responseMessage = data.replace(`RESPONSE TO CMD #${commandId}: `, '');
          if (!responses[commandId]) {
            responses[commandId] = [];
          }
          const { branch, group, cleanMessage } = extractMetadata(responseMessage);
          responses[commandId].push({
            id: id.toString(),
            sender,
            senderPosition,
            message: cleanMessage || responseMessage,
            originalMessage: data,
            branch,
            group,
            acknowledged,
            acknowledgedBy,
            timestamp: timestamp.toString()
          });
        } else {
          const { branch, group, cleanMessage } = extractMetadata(data);
          generalIntelligence.push({
            id: id.toString(),
            sender,
            senderPosition,
            message: cleanMessage || data,
            originalMessage: data,
            branch,
            group,
            acknowledged,
            acknowledgedBy,
            timestamp: timestamp.toString()
          });
        }
      }
      for (const commandId in responses) {
        responses[commandId].sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      }
      const sortedIntelligence = generalIntelligence.sort(
        (a, b) => parseInt(b.timestamp) - parseInt(a.timestamp)
      );
      setCommandResponses(responses);
      setIntelligenceMessages(sortedIntelligence);
    } catch (error) {
      console.error("Error fetching responses and intelligence:", error);
    }
  };

  // Fetch field data reports via the tactical contract
  const fetchFieldData = async () => {
    try {
      const signer = getRuntimeSigner();
      if (!contractAddresses.tactical || !signer) return;
      const tacticalABI = [
        "event FieldDataLogged(uint256 indexed id, address indexed sender, address indexed recipient, string data, uint256 timestamp)",
        "function fieldData(uint256) public view returns (uint256 id, address sender, address recipient, string data, uint256 timestamp, bool acknowledged, address acknowledgedBy, uint256 acknowledgedTimestamp)"
      ];
      const tacticalContract = new ethers.Contract(
        contractAddresses.tactical,
        tacticalABI,
        signer
      );
      const filter = tacticalContract.filters.FieldDataLogged(null, null, account);
      const events = await tacticalContract.queryFilter(filter);
      const processedFieldData = await Promise.all(events.map(async (event) => {
        const { id, sender, recipient, data, timestamp } = event.args;
        const senderPosition = await getPositionTitle(sender);
        let acknowledged = false;
        let acknowledgedBy = null;
        try {
          const fieldDataRecord = await tacticalContract.fieldData(id);
          acknowledged = fieldDataRecord.acknowledged;
          acknowledgedBy = fieldDataRecord.acknowledgedBy;
        } catch (error) {
          console.error("Error checking field data acknowledgment:", error);
        }
        const { branch, group, cleanMessage } = extractMetadata(data);
        return {
          id: id.toString(),
          sender,
          senderPosition,
          message: cleanMessage || data,
          originalMessage: data,
          branch,
          group,
          acknowledged,
          acknowledgedBy,
          timestamp: timestamp.toString()
        };
      }));
      const sortedFieldData = processedFieldData.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
      setFieldDataMessages(sortedFieldData);
    } catch (error) {
      console.error("Error fetching field data:", error);
    }
  };

  // Set up event listeners and load data when contract, account, and admin status are available
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCommands(),
        fetchIntelligence(),
        fetchFieldData()
      ]);
      setLoading(false);
    };
    
    if (contract && account && isAdmin) {
      loadData();
      try {
        // Command contract events
        if (contract) {
          const commandSentFilter = contract.filters.CommandSent();
          const commandAckFilter = contract.filters.CommandAcknowledged();
          contract.on(commandSentFilter, () => {
            console.log("New command detected");
            fetchCommands();
          });
          contract.on(commandAckFilter, () => {
            console.log("Command acknowledgment detected");
            fetchCommands();
          });
        }
        
        // Coordination contract events
        if (contractAddresses.coordination) {
          const signer = getRuntimeSigner();
          if (!signer) return;
          const coordABI = [
            "event IntelligenceSynced(uint256 indexed id, address indexed sender, address indexed recipient, string data, uint256 timestamp)",
            "event IntelligenceAcknowledged(uint256 indexed id, address indexed acknowledgedBy, uint256 timestamp)"
          ];
          const coordContract = new ethers.Contract(
            contractAddresses.coordination,
            coordABI,
            signer
          );
          const intelSyncedFilter = coordContract.filters.IntelligenceSynced(null, null, account);
          const intelAckFilter = coordContract.filters.IntelligenceAcknowledged();
          coordContract.on(intelSyncedFilter, () => {
            console.log("New intelligence received");
            fetchIntelligence();
          });
          coordContract.on(intelAckFilter, () => {
            console.log("Intelligence acknowledgment detected");
            fetchIntelligence();
          });
        }
        
        // Tactical contract events
        if (contractAddresses.tactical) {
          const signer = getRuntimeSigner();
          if (!signer) return;
          const tacticalABI = [
            "event FieldDataLogged(uint256 indexed id, address indexed sender, address indexed recipient, string data, uint256 timestamp)",
            "event FieldDataAcknowledged(uint256 indexed id, address indexed ackBy, uint256 timestamp)"
          ];
          const tacticalContract = new ethers.Contract(
            contractAddresses.tactical,
            tacticalABI,
            signer
          );
          const fieldDataFilter = tacticalContract.filters.FieldDataLogged(null, null, account);
          const fieldDataAckFilter = tacticalContract.filters.FieldDataAcknowledged();
          tacticalContract.on(fieldDataFilter, () => {
            console.log("New field data received");
            fetchFieldData();
          });
          tacticalContract.on(fieldDataAckFilter, () => {
            console.log("Field data acknowledgment detected");
            fetchFieldData();
          });
        }
        
        // Cleanup event listeners on unmount
        return () => {
          if (contract) {
            contract.removeAllListeners();
          }
          if (contractAddresses.coordination) {
            const signer = getRuntimeSigner();
            if (!signer) return;
            const coordContract = new ethers.Contract(
              contractAddresses.coordination,
              ["event IntelligenceSynced", "event IntelligenceAcknowledged"],
              signer
            );
            coordContract.removeAllListeners();
          }
          if (contractAddresses.tactical) {
            const signer = getRuntimeSigner();
            if (!signer) return;
            const tacticalContract = new ethers.Contract(
              contractAddresses.tactical,
              ["event FieldDataLogged", "event FieldDataAcknowledged"],
              signer
            );
            tacticalContract.removeAllListeners();
          }
        };
      } catch (error) {
        console.error("Error setting up event listeners:", error);
      }
    }
  }, [contract, account, isAdmin, contractAddresses]);

  // Helper functions to get branch and recipient group names (refactored versions)
  const getBranchNameFinal = (branch) => {
    switch (parseInt(branch)) {
      case 1: return "Army";
      case 2: return "Navy";
      case 3: return "Air Force";
      default: return "None";
    }
  };

  const getRecipientGroupNameFinal = (group) => {
    switch (parseInt(group)) {
      case 1: return "Command Center";
      case 2: return "Tactical Command";
      case 3: return "Coordination Command";
      case 4: return "Intelligence Command";
      default: return "None";
    }
  };

  // Get layer name based on layer ID
  const getLayerName = (layer) => {
    switch (parseInt(layer)) {
      case 1: return "Strategic";
      case 2: return "Operational";
      case 3: return "Tactical";
      default: return "Unknown";
    }
  };

  // Execute a command via the contract
  const executeCommand = async (commandId) => {
    if (!contract) return;
    try {
      const tx = await contract.executeCommand(commandId);
      await tx.wait();
      fetchCommands();
      alert(`Command #${commandId} has been executed.`);
    } catch (error) {
      console.error("Error executing command:", error);
      alert("Failed to execute command. Check console for details.");
    }
  };

  // Start responding to a message (field data or intelligence)
  const startResponding = (type, item) => {
    setRespondingTo({
      type,
      id: item.id,
      sender: item.sender,
      senderPosition: item.senderPosition,
      message: item.message
    });
    setResponseText("");
  };

  // Cancel the response action
  const cancelResponse = () => {
    setRespondingTo(null);
    setResponseText("");
  };

  // Acknowledge a field data message via the tactical contract
  const acknowledgeFieldData = async (id) => {
    try {
      const signer = getRuntimeSigner();
      if (!signer) throw new Error('No wallet signer available.');
      const tacticalContract = new ethers.Contract(
        contractAddresses.tactical,
        ["function acknowledgeFieldData(uint256 _id) public"],
        signer
      );
      const tx = await tacticalContract.acknowledgeFieldData(id);
      await tx.wait();
      alert(`Field data #${id} acknowledged.`);
      fetchFieldData();
    } catch (error) {
      console.error("Error acknowledging field data:", error);
      alert(`Error: ${error.message}`);
    }
  };

  // Acknowledge an intelligence message via the coordination contract
  const acknowledgeIntelligence = async (id) => {
    try {
      const signer = getRuntimeSigner();
      if (!signer) throw new Error('No wallet signer available.');
      const coordContract = new ethers.Contract(
        contractAddresses.coordination,
        ["function acknowledgeIntelligence(uint256 _intelId) public"],
        signer
      );
      const tx = await coordContract.acknowledgeIntelligence(id);
      await tx.wait();
      alert(`Intelligence #${id} acknowledged.`);
      fetchIntelligence();
    } catch (error) {
      console.error("Error acknowledging intelligence:", error);
      alert(`Error: ${error.message}`);
    }
  };

  // Send a response to field data or intelligence
  const sendResponse = async () => {
    if (!respondingTo || !responseText.trim()) {
      alert("Please enter a response message.");
      return;
    }
    try {
      const metadataPrefix = `[Branch: ${adminBranch}, Group: 1] `;
      const fullResponse = `RESPONSE TO ${respondingTo.type === 'field' ? 'FIELD DATA' : 'INTEL'} #${respondingTo.id}: ${metadataPrefix}${responseText}`;
      let respContract, methodName;
      if (respondingTo.type === 'intel') {
        const signer = getRuntimeSigner();
        if (!signer) throw new Error('No wallet signer available.');
        respContract = new ethers.Contract(
          contractAddresses.coordination,
          ["function syncIntelligence(address _recipient, string memory _data) public"],
          signer
        );
        methodName = "syncIntelligence";
      } else { // field data
        const signer = getRuntimeSigner();
        if (!signer) throw new Error('No wallet signer available.');
        respContract = new ethers.Contract(
          contractAddresses.tactical,
          ["function logFieldData(address _recipient, string memory _data) public"],
          signer
        );
        methodName = "logFieldData";
      }
      console.log(`Sending response using ${methodName} to:`, respondingTo.sender);
      const tx = await respContract[methodName](respondingTo.sender, fullResponse);
      await tx.wait();
      if (respondingTo.type === 'field') {
        try {
          await acknowledgeFieldData(respondingTo.id);
        } catch (error) {
          console.error("Error acknowledging field data:", error);
        }
      } else {
        try {
          await acknowledgeIntelligence(respondingTo.id);
        } catch (error) {
          console.error("Error acknowledging intelligence:", error);
        }
      }
      setRespondingTo(null);
      setResponseText("");
      alert("Response sent successfully!");
      if (respondingTo.type === 'intel') {
        fetchIntelligence();
      } else {
        fetchFieldData();
      }
    } catch (error) {
      console.error("Error sending response:", error);
      alert(`Error sending response: ${error.message}`);
    }
  };

  // Render field data section with updated response form (shows target information)
  const renderFieldDataSection = () => {
    return (
      <div className="field-data-section">
        <h3>Field Data Reports</h3>
        <p><strong>Your Branch:</strong> {getBranchNameFinal(adminBranch)}</p>
        {fieldDataMessages.length > 0 ? (
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fieldDataMessages.map(data => (
                <React.Fragment key={data.id}>
                  <tr className={data.acknowledged ? 'acknowledged' : ''}>
                    <td>{data.id}</td>
                    <td>{data.senderPosition}</td>
                    <td>{data.branch ? getBranchNameFinal(data.branch) : 'N/A'}</td>
                    <td>{data.group ? getRecipientGroupNameFinal(data.group) : 'N/A'}</td>
                    <td>{data.message}</td>
                    <td>{formatDate(data.timestamp)}</td>
                    <td>{data.acknowledged ? 'Acknowledged' : 'Pending'}</td>
                    <td>
                      {!data.acknowledged && (
                        <button 
                          className="btn btn-small" 
                          onClick={() => acknowledgeFieldData(data.id)}
                        >
                          Acknowledge
                        </button>
                      )}
                      <button 
                        className="btn btn-small response-btn" 
                        onClick={() => startResponding('field', data)}
                        style={{ marginLeft: '5px' }}
                      >
                        Respond
                      </button>
                    </td>
                  </tr>
                  {respondingTo && respondingTo.type === 'field' && respondingTo.id === data.id && (
                    <tr className="response-row">
                      <td colSpan="8">
                        <div className="response-form">
                          <h4>Responding to Field Data #{data.id}</h4>
                          <p><strong>Target: </strong>{data.senderPosition}</p>
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
                              onClick={sendResponse}
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
          <div className="no-data">No field data reports found.</div>
        )}
      </div>
    );
  };

  // Render intelligence section with updated response form
  const renderIntelligenceSection = () => {
    return (
      <div className="intelligence-section">
        <h3>Intelligence Reports</h3>
        <p><strong>Your Branch:</strong> {getBranchNameFinal(adminBranch)}</p>
        {intelligenceMessages.length > 0 ? (
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {intelligenceMessages.map(intel => (
                <React.Fragment key={intel.id}>
                  <tr className={intel.acknowledged ? 'acknowledged' : ''}>
                    <td>{intel.id}</td>
                    <td>{intel.senderPosition}</td>
                    <td>{intel.branch ? getBranchNameFinal(intel.branch) : 'N/A'}</td>
                    <td>{intel.group ? getRecipientGroupNameFinal(intel.group) : 'N/A'}</td>
                    <td>{intel.message}</td>
                    <td>{formatDate(intel.timestamp)}</td>
                    <td>{intel.acknowledged ? 'Acknowledged' : 'Pending'}</td>
                    <td>
                      {!intel.acknowledged && (
                        <button 
                          className="btn btn-small" 
                          onClick={() => acknowledgeIntelligence(intel.id)}
                        >
                          Acknowledge
                        </button>
                      )}
                      <button 
                        className="btn btn-small response-btn" 
                        onClick={() => startResponding('intel', intel)}
                        style={{ marginLeft: '5px' }}
                      >
                        Respond
                      </button>
                    </td>
                  </tr>
                  {respondingTo && respondingTo.type === 'intel' && respondingTo.id === intel.id && (
                    <tr className="response-row">
                      <td colSpan="8">
                        <div className="response-form">
                          <h4>Responding to Intelligence #{intel.id}</h4>
                          <p><strong>Target: </strong>{intel.senderPosition}</p>
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
                              onClick={sendResponse}
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
          <div className="no-data">No intelligence reports found.</div>
        )}
      </div>
    );
  };

  // Main render block with tab navigation and inbox integration
  return (
    <div className="admin-dashboard">
      <h2>Strategic Command Dashboard</h2>
      <p>Welcome, Commander {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
      
      <div className="admin-contracts-info">
        <h3>Command Information</h3>
        <p><strong>Your Branch Assignment:</strong> {getBranchNameFinal(adminBranch)}</p>
        <p><strong>Your Role:</strong> Strategic Command</p>
        <div className="contracts-addresses">
          <p><strong>Command Contract:</strong> {contractAddresses.command}</p>
          <p><strong>Coordination Contract:</strong> {contractAddresses.coordination}</p>
          <p><strong>Tactical Contract:</strong> {contractAddresses.tactical}</p>
        </div>
      </div>
      
      <div className="admin-nav form-control">
        <button 
          className={`btn ${selectedTab === 'commands' ? 'active-btn' : ''}`} 
          onClick={() => setSelectedTab('commands')}
        >
          Command Tracking
        </button>
        <button 
          className={`btn ${selectedTab === 'intelligence' ? 'active-btn' : ''}`} 
          onClick={() => setSelectedTab('intelligence')}
        >
          Intelligence Reports
        </button>
        <button 
          className={`btn ${selectedTab === 'field-data' ? 'active-btn' : ''}`} 
          onClick={() => setSelectedTab('field-data')}
        >
          Field Data
        </button>
        <button 
          className={`btn ${selectedTab === 'inbox' ? 'active-btn' : ''}`} 
          onClick={() => setSelectedTab('inbox')}
        >
          Inbox
        </button>
      </div>

      {selectedTab === 'commands' && (
        <div className="command-tracking-section">
          <h3>Command Tracking</h3>
          <p><strong>Your Branch:</strong> {getBranchNameFinal(adminBranch)}</p>
          {loading ? (
            <div className="loading">Loading command data...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Sender</th>
                  <th>Recipients</th>
                  <th>Layer</th>
                  <th>Branch</th>
                  <th>Command</th>
                  <th>Sent</th>
                  <th>Status</th>
                  <th>Acknowledged By</th>
                  <th>Ack. Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commands.map(cmd => (
                  <React.Fragment key={cmd.id}>
                    <tr className={cmd.acknowledged ? 'acknowledged' : ''}>
                      <td>{cmd.id}</td>
                      <td>{cmd.senderPosition}</td>
                      <td>{getRecipientGroupNameFinal(cmd.recipientGroup)}</td>
                      <td>{getLayerName(cmd.layer)}</td>
                      <td>{getBranchNameFinal(cmd.branch)}</td>
                      <td>{cmd.commandText}</td>
                      <td>{formatDate(cmd.timestamp)}</td>
                      <td>
                        {cmd.executed ? (
                          <span className="status-executed">Executed</span>
                        ) : cmd.acknowledged ? (
                          <span className="status-acknowledged">Acknowledged</span>
                        ) : (
                          <span className="status-pending">Pending</span>
                        )}
                      </td>
                      <td>{cmd.acknowledgedByPosition || 'N/A'}</td>
                      <td>{formatDate(cmd.acknowledgedTimestamp)}</td>
                      <td>
                        {!cmd.executed && (
                          <button 
                            className="btn btn-small execute-btn"
                            onClick={() => executeCommand(cmd.id)}
                          >
                            Execute
                          </button>
                        )}
                      </td>
                    </tr>
                    {/* Render any responses for this command */}
                    {commandResponses[cmd.id] && commandResponses[cmd.id].length > 0 && (
                      <tr className="responses-row">
                        <td colSpan="11">
                          <div className="responses-container">
                            <h4>Responses:</h4>
                            {commandResponses[cmd.id].map((response, index) => (
                              <div key={index} className="response-item">
                                <p>
                                  <strong>From:</strong> {response.senderPosition} | 
                                  {response.branch && <span><strong> Branch:</strong> {getBranchNameFinal(response.branch)} | </span>}
                                  {response.group && <span><strong> Group:</strong> {getRecipientGroupNameFinal(response.group)} | </span>}
                                  <strong> Time:</strong> {formatDate(response.timestamp)}
                                </p>
                                <p className="response-message">{response.message}</p>
                                {!response.acknowledged && (
                                  <div className="response-actions">
                                    <button 
                                      className="btn btn-small"
                                      onClick={() => acknowledgeIntelligence(response.id)}
                                    >
                                      Acknowledge
                                    </button>
                                    <button 
                                      className="btn btn-small response-btn"
                                      onClick={() => startResponding('intel', response)}
                                      style={{ marginLeft: '5px' }}
                                    >
                                      Respond
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {selectedTab === 'intelligence' && renderIntelligenceSection()}
      {selectedTab === 'field-data' && renderFieldDataSection()}
      {selectedTab === 'inbox' && (
        <div>
          <div className="admin-nav form-control">
            {Object.entries(inboxTitles).map(([key, title]) => (
              <button 
                key={key} 
                className={`btn ${selectedInbox === key ? 'active-btn' : ''}`} 
                onClick={() => setSelectedInbox(key)}
              >
                {title}
              </button>
            ))}
          </div>
          <h3>{inboxTitles[selectedInbox]} Inbox</h3>
          <Inbox
            contract={contract}
            account={account}
            isAdmin={true}
            adminFilterRecipientGroup={selectedInbox}
          />
        </div>
      )}
      {loading && <div className="loader-container"><div className="spinner"></div></div>}
    </div>
  );
};

export default AdminDashboard;
