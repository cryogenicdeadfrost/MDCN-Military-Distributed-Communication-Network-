// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.scss';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loader from './components/Loader';
import CommandSection from './components/CommandSection';
import CoordinationSection from './components/CoordinationSection';
import TacticalSection from './components/TacticalSection';
import Inbox from './components/Inbox';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import SubordinateLogin from './pages/SubordinateLogin';
import SubordinateDashboard from './pages/SubordinateDashboard';
import SoftHatModal from './components/SoftHatModal';
import { ethers } from 'ethers';

const commandContractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const coordinationContractAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const tacticalContractAddress = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';

const adminAddresses = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase(),
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase(),
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'.toLowerCase()
];

const commandABI = [
  'function sendCommand(uint8 _layer, uint8 _recipientGroup, uint8 _branch, string memory _commandText) public',
  'function sendDirectCommand(address _recipient, uint8 _layer, string memory _commandText) public',
  'function executeCommand(uint256 _commandId) public',
  'function acknowledgeCommand(uint256 _commandId) public',
  'function roles(address) public view returns (uint8)',
  'function assignRole(address _account, uint8 _role) public',
  'function setRole(address _account, uint8 _roleId) public',
  'function commands(uint256) public view returns (uint256 id, address sender, uint8 recipientGroup, uint8 branch, uint8 layer, string commandText, uint256 timestamp, bool executed, bool acknowledged, address acknowledgedBy, uint256 acknowledgedTimestamp)',
  'event CommandSent(uint256 indexed id, address indexed sender, uint8 recipientGroup, uint8 branch, uint8 layer, string commandText, uint256 timestamp)',
  'event CommandAcknowledged(uint256 indexed id, address indexed acknowledgedBy, uint256 timestamp)',
  'event RoleAssigned(address indexed account, uint8 role)'
];

const coordinationABI = [
  'function syncIntelligenceLegacy(uint8 _recipientGroup, uint8 _branch, string memory _data) public',
  'function syncIntelligence(address _recipient, string memory _data) public',
  'function acknowledgeIntelligence(uint256 _intelId) public',
  'function intelStore(uint256) public view returns (uint256 id, address sender, address recipient, string memory intelData, uint256 timestamp, bool acknowledged, address acknowledgedBy, uint256 acknowledgedTimestamp)',
  'event IntelligenceSynced(uint256 indexed id, address indexed sender, address indexed recipient, string data, uint256 timestamp)',
  'event IntelligenceAcknowledged(uint256 indexed id, address indexed acknowledgedBy, uint256 timestamp)'
];

const tacticalABI = [
  'function logFieldDataLegacy(uint8 _recipientGroup, uint8 _branch, string memory _data) public',
  'function logFieldData(address _recipient, string memory _data) public',
  'function acknowledgeFieldData(uint256 _id) public',
  'function updateMaintenanceLegacy(uint8 _recipientGroup, uint8 _branch, uint256 _assetId, string memory _status) public',
  'function updateMaintenance(address _recipient, uint256 _assetId, string memory _status) public',
  'function acknowledgeMaintenance(uint256 _id) public',
  'function fieldData(uint256) public view returns (uint256 id, address sender, address recipient, string memory data, uint256 timestamp, bool acknowledged, address acknowledgedBy, uint256 acknowledgedTimestamp)',
  'function maintenanceData(uint256) public view returns (uint256 id, address sender, address recipient, uint256 assetId, string memory status, uint256 timestamp, bool acknowledged, address acknowledgedBy, uint256 acknowledgedTimestamp)',
  'function fieldCount() public view returns (uint256)',
  'function maintenanceCount() public view returns (uint256)',
  'event FieldDataLogged(uint256 indexed id, address indexed sender, address indexed recipient, string data, uint256 timestamp)',
  'event FieldDataAcknowledged(uint256 indexed id, address indexed ackBy, uint256 timestamp)',
  'event MaintenanceUpdated(uint256 indexed id, address indexed sender, address indexed recipient, uint256 assetId, string status, uint256 timestamp)',
  'event MaintenanceAcknowledged(uint256 indexed id, address indexed ackBy, uint256 timestamp)'
];

const ROLES = { NONE: 0, STRATEGIC: 1, OPERATIONAL: 2, TACTICAL: 3 };

function App() {
  const [account, setAccount] = useState('');
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(ROLES.NONE);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOperational, setIsOperational] = useState(false);
  const [isTactical, setIsTactical] = useState(false);
  const [isSubordinate, setIsSubordinate] = useState(false);
  const [walletMode, setWalletMode] = useState('');
  const [softHatOpen, setSoftHatOpen] = useState(false);
  const [softHatAccounts, setSoftHatAccounts] = useState([]);
  const [walletStatus, setWalletStatus] = useState('');


  const buildRouteHint = (index) => {
    if (index <= 2) return 'Strategic / Main Command Centre';
    if (index <= 10) return 'Operational / Coordination';
    return 'Tactical / Field Ops';
  };

  const clearSession = () => {
    setAccount('');
    setContracts({});
    setUserRole(ROLES.NONE);
    setIsAdmin(false);
    setIsOperational(false);
    setIsTactical(false);
    setIsSubordinate(false);
  };

  const initializeContracts = async (signer, address, modeLabel) => {
    const commandContract = new ethers.Contract(commandContractAddress, commandABI, signer);
    const coordinationContract = new ethers.Contract(coordinationContractAddress, coordinationABI, signer);
    const tacticalContract = new ethers.Contract(tacticalContractAddress, tacticalABI, signer);

    setContracts({ commandContract, coordinationContract, tacticalContract, signer });
    setAccount(address);
    setWalletMode(modeLabel);

    console.log('[MDCN][Wallet] Connected', { mode: modeLabel, account: address });

    const role = await commandContract.roles(address);
    const roleNumber = Number(role.toString());
    setUserRole(roleNumber);
    setIsAdmin(roleNumber === ROLES.STRATEGIC);
    setIsOperational(roleNumber === ROLES.OPERATIONAL);
    setIsTactical(roleNumber === ROLES.TACTICAL);
    setIsSubordinate(roleNumber === ROLES.OPERATIONAL || roleNumber === ROLES.TACTICAL);
  };

  const connectMetaMask = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed. You can use SoftHat for localnet.');
      return;
    }
    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const addr = await signer.getAddress();
      await initializeContracts(signer, addr, 'metamask');
      setWalletStatus('Connected with MetaMask.');
    } catch (error) {
      alert('Error connecting MetaMask.');
    } finally {
      setLoading(false);
    }
  };

  const connectSoftHat = async (privateKey) => {
    setLoading(true);
    try {
      const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
      const network = await provider.getNetwork();
      if (![31337, 1337].includes(Number(network.chainId))) {
        throw new Error('SoftHat supports localhost networks only (31337/1337).');
      }
      const wallet = new ethers.Wallet(privateKey, provider);
      await initializeContracts(wallet, wallet.address, 'softhat');
      setWalletStatus(`SoftHat connected: ${wallet.address}`);
      setSoftHatOpen(false);
    } catch (error) {
      alert(`SoftHat import failed: ${error.message}`);
      setWalletStatus(`SoftHat error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openWalletHub = () => {
    if (window.ethereum) {
      const useMetaMask = window.confirm('Use MetaMask? Click Cancel for SoftHat local wallet.');
      if (useMetaMask) {
        connectMetaMask();
        return;
      }
    }
    setSoftHatOpen(true);
  };

  const logoutUser = () => {
    clearSession();
    setWalletMode('');
    setWalletStatus('Logged out. Select another ID to continue.');
    window.location.href = '/';
  };

  useEffect(() => {
    fetch('/softhat-accounts.json')
      .then((response) => response.json())
      .then((data) => {
        const mapped = (data.accounts || []).map((account) => ({
          ...account,
          routeHint: buildRouteHint(Number(account.index || 0)),
        }));
        setSoftHatAccounts(mapped);
      })
      .catch(() => setSoftHatAccounts([]));

    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (walletMode === 'metamask' && accounts.length > 0) {
          connectMetaMask();
        } else if (accounts.length === 0) {
          clearSession();
        }
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }
  }, [walletMode]);

  const renderRoleBasedSections = () => (
    <>
      {isAdmin && <CommandSection contracts={contracts} account={account} userRole={userRole} />}
      {(isAdmin || isOperational) && (
        <CoordinationSection contracts={contracts} account={account} userRole={userRole} adminAddresses={adminAddresses} />
      )}
      {(isTactical || isOperational) && !isAdmin && (
        <TacticalSection contracts={contracts} account={account} userRole={userRole} adminAddresses={adminAddresses} />
      )}
      {userRole > ROLES.NONE && <Inbox contract={contracts.commandContract} account={account} isAdmin={isAdmin} userRole={userRole} />}
    </>
  );

  return (
    <Router>
      <div className="App">
        <Navbar
          account={account}
          onConnectWallet={openWalletHub}
          isAdmin={isAdmin}
          userRole={userRole}
          logoutUser={logoutUser}
          walletMode={walletMode}
        />
        {loading && <Loader />}
        <SoftHatModal
          open={softHatOpen}
          onClose={() => setSoftHatOpen(false)}
          accounts={softHatAccounts}
          onConnect={connectSoftHat}
          loading={loading}
          walletStatus={walletStatus}
          activeAddress={account}
        />
        <Routes>
          <Route
            path="/"
            element={
              <main>
                {userRole > ROLES.NONE ? (
                  renderRoleBasedSections()
                ) : (
                  <div className="unauthorized-message">
                    <h2>Unauthorized Access</h2>
                    <p>Your account does not have any assigned role in the system.</p>
                    <p>Use MetaMask or SoftHat with another localnet account to continue.</p>
                  </div>
                )}
              </main>
            }
          />
          <Route path="/admin/login" element={isAdmin ? <AdminLogin account={account} isAdmin={isAdmin} /> : <Navigate to="/" replace />} />
          <Route
            path="/admin/dashboard"
            element={
              isAdmin ? (
                <AdminDashboard
                  contract={contracts.commandContract}
                  contracts={contracts}
                  account={account}
                  isAdmin={isAdmin}
                  contractAddresses={{
                    command: commandContractAddress,
                    coordination: coordinationContractAddress,
                    tactical: tacticalContractAddress
                  }}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/subordinate/login" element={isSubordinate ? <SubordinateLogin account={account} userRole={userRole} /> : <Navigate to="/" replace />} />
          <Route
            path="/subordinate/dashboard"
            element={
              isSubordinate ? (
                <SubordinateDashboard contracts={contracts} account={account} userRole={userRole} adminAddresses={adminAddresses} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
