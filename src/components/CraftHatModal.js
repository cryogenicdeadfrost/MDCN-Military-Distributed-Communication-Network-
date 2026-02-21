import React, { useMemo, useState } from 'react';

const short = (value = '') => `${value.slice(0, 6)}...${value.slice(-4)}`;

const CraftHatModal = ({
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
    return [...accounts].sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
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

  return (
    <div className="crafthat-overlay" onClick={onClose}>
      <div className="crafthat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crafthat-header">
          <h3>CraftHat Local Wallet</h3>
          <button className="btn btn-small" onClick={onClose}>Close</button>
        </div>

        <p className="crafthat-note">
          Localnet only. Import any Hardhat private key below, connect, then switch IDs to send/acknowledge messages.
        </p>

        {walletStatus && <pre className="output">{walletStatus}</pre>}

        <div className="form-control">
          <label>Import Hardhat Private Key (manual):</label>
          <input
            type="text"
            value={manualKey}
            onChange={(e) => setManualKey(e.target.value)}
            placeholder="0x..."
          />
          <button className="btn" disabled={loading || !manualKey.trim()} onClick={() => onConnect(manualKey.trim())}>
            Import & Connect
          </button>
        </div>

        <h4>Quick Local Accounts</h4>
        <div className="crafthat-account-list">
          {sortedAccounts.map((item) => (
            <div key={item.address} className="crafthat-account-row">
              <div>
                <strong>#{item.index}</strong> {short(item.address)} {activeAddress?.toLowerCase() === item.address?.toLowerCase() ? '• Active' : ''}
                <div className="crafthat-meta">Token: {item.token || `CRAFT-${item.index ?? 0}`}</div>
              </div>
              <div className="crafthat-actions">
                <button className="btn btn-small" onClick={() => copyText(item.privateKey)}>Copy Key</button>
                <button className="btn btn-small" onClick={() => copyText(item.token || `CRAFT-${item.index ?? 0}`)}>Copy Token</button>
                <button className="btn btn-small" disabled={loading} onClick={() => onConnect(item.privateKey)}>Use</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CraftHatModal;
