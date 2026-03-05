import React, { useMemo, useState } from 'react';
import { branchFromIndex, roleProfileFromIndex } from '../utils/txBatch';

const short = (value = '') => `${value.slice(0, 6)}...${value.slice(-4)}`;

const SoftHatModal = ({
  open,
  onClose,
  accounts = [],
  onConnect,
  loading,
  walletStatus,
  activeAddress
}) => {
  const [manualKey, setManualKey] = useState('');

  const sortedAccounts = useMemo(() => {
    return [...accounts]
      .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0))
      .map((item) => {
        const branch = branchFromIndex(item.index);
        const roleProfile = roleProfileFromIndex(item.index);
        return {
          ...item,
          branch,
          roleProfile,
        };
      });
  }, [accounts]);

  if (!open) return null;

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard.');
    } catch (error) {
      alert('Unable to copy in this browser context.');
    }
  };

  const handleUseAccount = (item) => {
    const enteredKey = window.prompt(
      `Secure Login: Enter the private key for Account #${item.index} (${item.roleProfile.role} - ${item.branch.name})\n\nHint: Use the 'Copy Key' button first.`
    );

    // If user clicked Cancel
    if (enteredKey === null) return;

    if (enteredKey.trim() === item.privateKey) {
      onConnect(item.privateKey);
    } else {
      alert("Authentication Failed: The provided private key is incorrect.");
    }
  };

  return (
    <div className="softhat-overlay" onClick={onClose}>
      <div className="softhat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="softhat-header">
          <h3>SoftHat Local Wallet Hub</h3>
          <button className="btn btn-small" onClick={onClose}>Close</button>
        </div>

        <p className="softhat-note">
          Localhost mode only. Import any Hardhat private key, switch IDs quickly, and route messages with mapped branch/section metadata.
        </p>

        {walletStatus && <pre className="output">{walletStatus}</pre>}

        <div className="form-control">
          <label>Import Hardhat Private Key:</label>
          <input
            type="text"
            value={manualKey}
            onChange={(e) => setManualKey(e.target.value)}
            placeholder="0x..."
          />
          <button className="btn" disabled={loading || !manualKey.trim()} onClick={() => onConnect(manualKey.trim())}>
            Import and Connect
          </button>
        </div>

        <h4>SoftHat Account Map (Hardhat)</h4>
        <div className="softhat-account-list">
          {sortedAccounts.map((item) => (
            <div key={item.address} className="softhat-account-row">
              <div className="softhat-identity">
                <strong>#{item.index}</strong> {short(item.address)} {activeAddress?.toLowerCase() === item.address?.toLowerCase() ? '• Active' : ''}
                <div className="softhat-meta">Token: {item.token || `SOFT-${item.index ?? 0}`}</div>
                <div className="softhat-meta">Role: {item.roleProfile.role} | Section: {item.roleProfile.section}</div>
                <div className="softhat-meta">Branch: {item.branch.name}</div>
              </div>
              <div className="softhat-actions">
                <button className="btn btn-small" onClick={() => copyText(item.privateKey)}>Copy Key</button>
                <button className="btn btn-small" onClick={() => copyText(item.token || `SOFT-${item.index ?? 0}`)}>Copy Token</button>
                <button className="btn btn-small" disabled={loading} onClick={() => handleUseAccount(item)}>Use</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SoftHatModal;
