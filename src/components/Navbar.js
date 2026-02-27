// src/components/Navbar.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ account, onConnectWallet, isAdmin, userRole, logoutUser, walletMode }) => {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleAdminClick = () => {
    if (isAdmin) {
      navigate('/admin/login');
    } else {
      alert("You don't have admin access.");
    }
  };

  const handleSubordinateClick = () => {
    if (userRole > 1) {
      navigate('/subordinate/login');
    } else if (userRole === 1) {
      alert('As an admin, please use the Admin dashboard.');
    } else {
      alert("You don't have any assigned role in the system.");
    }
  };

  const getPositionTitle = (role, acct) => {
    const shortID = acct ? `${acct.substring(0, 6)}...${acct.substring(acct.length - 4)}` : '';
    switch (role) {
      case 1: return `Strategic Commander (${shortID})`;
      case 2: return `Operational Officer (${shortID})`;
      case 3: return `Field Operative (${shortID})`;
      default: return `Unknown (${shortID})`;
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
        <div className="navbar-brand animate-logo">MDCN (Military Distributed Communication Network)</div>
      </div>
      <div className="navbar-right">
        {account ? (
          <>
            <span className="position-info">{getPositionTitle(userRole, account)}</span>
            <span className="wallet-chip">{walletMode === 'softhat' ? 'SoftHat' : 'MetaMask'}</span>
            <button className="btn logout-btn" onClick={logoutUser}>Logout</button>
            {userRole > 1 && (
              <button className="btn field-btn" onClick={handleSubordinateClick}>Field Ops</button>
            )}
            {isAdmin && (
              <button className="btn admin-btn" onClick={handleAdminClick}>Admin</button>
            )}
          </>
        ) : (
          <button className="btn connect-btn" onClick={onConnectWallet}>Connect Wallet</button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
