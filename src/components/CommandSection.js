// src/components/CoordinationSection.js
import React, { useState, useEffect } from 'react';
import { sendBatchWithNonceControl } from '../utils/txBatch';

const CoordinationSection = ({ contracts, account, userRole, adminAddresses }) => {
  const [recipientGroup, setRecipientGroup] = useState("4"); // Default: Intelligence Command
  const [branch, setBranch] = useState("1"); // Default: Army
  const [intel, setIntel] = useState("");
  const [output, setOutput] = useState("");
  const [userBranch, setUserBranch] = useState("1"); // Default branch for this user
  const [broadcastMode, setBroadcastMode] = useState(false); // Whether to send to all admins
  const [directMode, setDirectMode] = useState(false); // Whether to send to a specific admin
  const [selectedAdminIndex, setSelectedAdminIndex] = useState(0);

  // Detect user's branch
  useEffect(() => {
    if (account) {
      const lastChar = account.slice(-1);
      const lastDigit = parseInt(lastChar, 16) % 3;
      setUserBranch((lastDigit + 1).toString());
      setBranch((lastDigit + 1).toString());
    }
  }, [account]);

  const ROLES = {
    NONE: 0,
    STRATEGIC: 1,
    OPERATIONAL: 2,
    TACTICAL: 3,
  };

  const getBranchName = (branchId) => {
    switch (parseInt(branchId)) {
      case 1: return "Army";
      case 2: return "Navy";
      case 3: return "Air Force";
      default: return "Unknown";
    }
  };

  const getRecipientGroupName = (groupId) => {
    switch (parseInt(groupId)) {
      case 1: return "Command Center";
      case 2: return "Tactical Command";
      case 3: return "Coordination Command";
      case 4: return "Intelligence Command";
      default: return "Unknown";
    }
  };

  const handleModeChange = (mode) => {
    if (mode === 'group') {
      setBroadcastMode(false);
      setDirectMode(false);
    } else if (mode === 'broadcast') {
      setBroadcastMode(true);
      setDirectMode(false);
    } else if (mode === 'direct') {
      setBroadcastMode(false);
      setDirectMode(true);
    }
  };

  const syncIntelligence = async () => {
    if (!intel || !contracts.coordinationContract) {
      alert("Enter intelligence data and ensure you are connected.");
      return;
    }
    
    try {
      setOutput("Preparing to send intelligence...");
      const metadataPrefix = `[Branch: ${userBranch}, Group: ${recipientGroup}] `;
      const fullMessage = metadataPrefix + intel;

      // Determine which function to call explicitly by signature
      if (broadcastMode) {
        if (!adminAddresses || adminAddresses.length === 0) {
          setOutput("No admin addresses available for broadcasting.");
          return;
        }
        
        setOutput(`Broadcasting intelligence to ${adminAddresses.length} recipients with nonce control...`);
        const signer = contracts?.coordinationContract?.signer;
        const calls = adminAddresses.map((addr) => (overrides) =>
          contracts.coordinationContract["syncIntelligence(address,string)"](addr, fullMessage, overrides)
        );

        const batch = await sendBatchWithNonceControl({
          signer,
          makeTxCalls: calls,
          onProgress: ({ stage, index, nonce, hash, blockNumber }) => {
            console.log('[MDCN][Coordination][Broadcast]', { stage, index, nonce, hash, blockNumber, to: adminAddresses[index] });
          },
        });

        const txHashes = batch.txs.map(tx => tx.hash).join("\n");
        setOutput(prev => `${prev}\nBroadcast initiated. Transaction hashes:\n${txHashes}`);
        setOutput(prev => `${prev}\nIntelligence successfully broadcast to all recipients.`);
      } else if (directMode) {
        if (!adminAddresses || adminAddresses.length === 0 || selectedAdminIndex >= adminAddresses.length) {
          setOutput("Selected admin address is not available.");
          return;
        }
        
        const adminAddress = adminAddresses[selectedAdminIndex];
        setOutput(`Sending intelligence directly to Admin ${selectedAdminIndex + 1} (${adminAddress.substring(0,6)}...${adminAddress.substring(adminAddress.length - 4)})...`);
        
        const tx = await contracts.coordinationContract["syncIntelligence(address,string)"](adminAddress, fullMessage);
        console.log('[MDCN][Coordination][Direct]', { to: adminAddress, hash: tx.hash, mode: 'direct-admin' });
        setOutput(prev => `${prev}\nTransaction sent: ${tx.hash}`);
        await tx.wait();
        setOutput(prev => `${prev}\nIntelligence sent successfully to admin.`);
      } else {
        // Group/Branch method using explicit signature:
        const _recipientGroup = parseInt(recipientGroup);
        const _branch = parseInt(branch);
        const tx = await contracts.coordinationContract["syncIntelligence(uint8,uint8,string)"](
          _recipientGroup, 
          _branch, 
          fullMessage
        );
        console.log('[MDCN][Coordination][Group]', { recipientGroup: _recipientGroup, branch: _branch, hash: tx.hash });
        setOutput(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        setOutput(prev => prev + "\nIntelligence synced successfully.");
      }
    } catch (error) {
      console.error("Error syncing intelligence:", error);
      const errorMessage = error.reason || error.message || "Unknown error occurred";
      setOutput(`Error: ${errorMessage}`);
      if (error.stack) {
        console.error("Error stack:", error.stack);
      }
    }
  };

  return (
    <section className="card">
      <h2>Interoperability & Coordination</h2>
      <p><strong>Your Branch:</strong> {getBranchName(userBranch)}</p>
      <p><strong>Your Role:</strong> {userRole === ROLES.STRATEGIC ? "Strategic Command" : userRole === ROLES.OPERATIONAL ? "Operational Command" : "Tactical Unit"}</p>
      
      <div className="form-control">
        <label>Intelligence Mode:</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="group"
              checked={!broadcastMode && !directMode}
              onChange={() => handleModeChange('group')}
            />
            Group Method (to recipient group)
          </label>
          {adminAddresses && adminAddresses.length > 0 && (
            <>
              <label>
                <input
                  type="radio"
                  value="broadcast"
                  checked={broadcastMode}
                  onChange={() => handleModeChange('broadcast')}
                />
                Broadcast (to all admins)
              </label>
              <label>
                <input
                  type="radio"
                  value="direct"
                  checked={directMode}
                  onChange={() => handleModeChange('direct')}
                />
                Direct (to specific admin)
              </label>
            </>
          )}
        </div>
      </div>
      
      {directMode && adminAddresses && adminAddresses.length > 0 && (
        <div className="form-control">
          <label>Select Admin:</label>
          <select
            value={selectedAdminIndex}
            onChange={e => setSelectedAdminIndex(parseInt(e.target.value))}
          >
            {adminAddresses.map((addr, index) => (
              <option key={index} value={index}>
                Admin {index + 1} - {addr.substring(0, 6)}...{addr.substring(addr.length - 4)}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {(!broadcastMode && !directMode) && (
        <>
          <div className="form-control">
            <label>Select Recipient Group:</label>
            <select value={recipientGroup} onChange={e => setRecipientGroup(e.target.value)}>
              <option value="1">Command Center</option>
              <option value="2">Tactical Command</option>
              <option value="3">Coordination Command</option>
              <option value="4">Intelligence Command</option>
            </select>
          </div>
          <div className="form-control">
            <label>Select Branch:</label>
            <select value={branch} onChange={e => setBranch(e.target.value)}>
              <option value="1">Army</option>
              <option value="2">Navy</option>
              <option value="3">Air Force</option>
            </select>
          </div>
        </>
      )}
      
      <div className="form-control">
        <label>Intelligence Data:</label>
        <textarea
          rows="4"
          value={intel}
          onChange={e => setIntel(e.target.value)}
          placeholder="Enter intelligence data..."
          className="intel-textarea"
        />
      </div>
      
      <button className="btn" onClick={syncIntelligence}>
        {broadcastMode ? 'Broadcast Intelligence' : directMode ? 'Send Direct Intelligence' : 'Sync Intelligence'}
      </button>
      
      <div className="intel-summary">
        {broadcastMode ? (
          <p>This intelligence will be sent to <strong>all Strategic Command admins</strong>.</p>
        ) : directMode ? (
          <p>This intelligence will be sent directly to <strong>Admin {selectedAdminIndex + 1}</strong>.</p>
        ) : (
          <p>This intelligence will be sent to <strong>{getRecipientGroupName(recipientGroup)}</strong> in the <strong>{getBranchName(branch)}</strong> branch.</p>
        )}
      </div>
      
      <pre className="output">{output}</pre>
    </section>
  );
};

export default CoordinationSection;
