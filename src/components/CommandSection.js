// src/components/CommandSection.js
import React, { useState, useEffect } from 'react';
import { sendBatchWithNonceControl } from '../utils/txBatch';

const CommandSection = ({ contracts, account, userRole, adminAddresses }) => {
  const [recipientGroup, setRecipientGroup] = useState('1');
  const [branch, setBranch] = useState('1');
  const [commandText, setCommandText] = useState('');
  const [output, setOutput] = useState('');
  const [userBranch, setUserBranch] = useState('1');
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [directMode, setDirectMode] = useState(false);
  const [selectedAdminIndex, setSelectedAdminIndex] = useState(0);

  useEffect(() => {
    if (account) {
      const lastDigit = parseInt(account.slice(-1), 16) % 3;
      const b = (lastDigit + 1).toString();
      setUserBranch(b);
      setBranch(b);
    }
  }, [account]);

  const handleModeChange = (mode) => {
    setBroadcastMode(mode === 'broadcast');
    setDirectMode(mode === 'direct');
  };

  const getBranchName = (id) => ({ 1: 'Army', 2: 'Navy', 3: 'Air Force' }[Number(id)] || 'Unknown');
  const getRecipientGroupName = (id) => ({
    1: 'Command Center',
    2: 'Tactical Command',
    3: 'Coordination Command',
    4: 'Intelligence Command'
  }[Number(id)] || 'Unknown');

  const sendCommand = async () => {
    if (!commandText.trim() || !contracts.commandContract) {
      alert('Enter command text and ensure contract is connected.');
      return;
    }

    try {
      setOutput('Preparing strategic command...');
      const metadataPrefix = `[Branch: ${userBranch}, Group: ${recipientGroup}] `;
      const fullMessage = metadataPrefix + commandText;

      if (broadcastMode) {
        if (!adminAddresses || adminAddresses.length === 0) {
          setOutput('No admin addresses available for broadcast.');
          return;
        }

        const signer = contracts?.commandContract?.signer;
        const calls = adminAddresses.map((addr) => (overrides) =>
          contracts.commandContract.sendDirectCommand(addr, 1, fullMessage, overrides)
        );

        const batch = await sendBatchWithNonceControl({
          signer,
          makeTxCalls: calls,
          onProgress: ({ stage, index, nonce, hash, blockNumber }) => {
            console.log('[MDCN][Command][Broadcast]', { stage, index, nonce, hash, blockNumber, to: adminAddresses[index] });
          },
        });

        setOutput(`Broadcasted command to ${adminAddresses.length} recipients.\n${batch.txs.map((tx) => tx.hash).join('\n')}`);
      } else if (directMode) {
        if (!adminAddresses || selectedAdminIndex >= adminAddresses.length) {
          setOutput('Selected direct recipient is unavailable.');
          return;
        }

        const to = adminAddresses[selectedAdminIndex];
        const tx = await contracts.commandContract.sendDirectCommand(to, 1, fullMessage);
        console.log('[MDCN][Command][Direct]', { to, hash: tx.hash });
        setOutput(`Direct command sent: ${tx.hash}`);
        await tx.wait();
        setOutput((prev) => `${prev}\nDirect command confirmed.`);
      } else {
        const tx = await contracts.commandContract.sendCommand(1, parseInt(recipientGroup), parseInt(branch), fullMessage);
        console.log('[MDCN][Command][Group]', { group: recipientGroup, branch, hash: tx.hash });
        setOutput(`Group command sent: ${tx.hash}`);
        await tx.wait();
        setOutput((prev) => `${prev}\nGroup command confirmed.`);
      }
    } catch (error) {
      console.error('Error sending command:', error);
      let errMsg = error.reason || error.message || 'Unknown error occurred';

      // Extract custom solidity errors
      if (errMsg.includes("Protocol Breach:")) {
        const breachMatch = errMsg.match(/Protocol Breach: ([^"]+)/);
        if (breachMatch) {
          errMsg = `BLOCKED: Protocol Breach\n\n${breachMatch[1]}`;
          alert(errMsg);
        }
      }
      setOutput(`Error: ${errMsg}`);
    }
  };

  return (
    <section className="card">
      <h2>Strategic Command Dispatch</h2>
      <p><strong>Your Branch:</strong> {getBranchName(userBranch)}</p>
      <div className="form-control">
        <label>Dispatch Mode:</label>
        <div className="radio-group">
          <label><input type="radio" checked={!broadcastMode && !directMode} onChange={() => handleModeChange('group')} /> Group</label>
          {adminAddresses?.length > 0 && (
            <>
              <label><input type="radio" checked={broadcastMode} onChange={() => handleModeChange('broadcast')} /> Broadcast to admins</label>
              <label><input type="radio" checked={directMode} onChange={() => handleModeChange('direct')} /> Direct admin</label>
            </>
          )}
        </div>
      </div>

      {directMode && adminAddresses?.length > 0 && (
        <div className="form-control">
          <label>Select Admin Recipient:</label>
          <select value={selectedAdminIndex} onChange={(e) => setSelectedAdminIndex(parseInt(e.target.value))}>
            {adminAddresses.map((addr, idx) => (
              <option key={addr} value={idx}>Admin {idx + 1} - {addr.slice(0, 6)}...{addr.slice(-4)}</option>
            ))}
          </select>
        </div>
      )}

      {!broadcastMode && !directMode && (
        <>
          <div className="form-control">
            <label>Recipient Group:</label>
            <select value={recipientGroup} onChange={(e) => setRecipientGroup(e.target.value)}>
              <option value="1">Command Center</option>
              <option value="2">Tactical Command</option>
              <option value="3">Coordination Command</option>
              <option value="4">Intelligence Command</option>
            </select>
          </div>
          <div className="form-control">
            <label>Branch:</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="1">Army</option>
              <option value="2">Navy</option>
              <option value="3">Air Force</option>
            </select>
          </div>
        </>
      )}

      <div className="form-control">
        <label>Strategic Command Text:</label>
        <textarea className="command-textarea" rows="5" value={commandText} onChange={(e) => setCommandText(e.target.value)} placeholder="Enter command order..." />
      </div>

      <button className="btn" onClick={sendCommand}>Send Command</button>

      <div className="intel-summary">
        {broadcastMode ? (
          <p>This command will be dispatched to all admin recipients.</p>
        ) : directMode ? (
          <p>This command will be dispatched to one selected admin recipient.</p>
        ) : (
          <p>This command will be dispatched to <strong>{getRecipientGroupName(recipientGroup)}</strong> in <strong>{getBranchName(branch)}</strong>.</p>
        )}
      </div>

      <pre className="output">{output}</pre>
    </section>
  );
};

export default CommandSection;
