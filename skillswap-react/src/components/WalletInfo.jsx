import React, { useContext } from 'react';
import { WalletContext } from '../context/WalletContext';

const WalletInfo = () => {
  const { accountId, evmAddress, walletBalance } = useContext(WalletContext);

  if (!accountId) return null;

  return (
    <div className="wallet-info">
      <p><strong>Account ID:</strong> {accountId}</p>
      <p><strong>EVM Address:</strong> {evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : 'N/A'}</p>
      <p><strong>Balance:</strong> {walletBalance ? `${walletBalance} ℏ` : 'Loading...'}</p>
    </div>
  );
};

export default WalletInfo;
