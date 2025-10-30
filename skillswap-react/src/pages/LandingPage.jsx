import React, { useContext } from 'react';
import { WalletContext } from '../context/WalletContext';

const LandingPage = () => {
  const { handleCreateVault, isProcessing, status, isRestoring } = useContext(WalletContext);

  if (isRestoring) {
    return (
      <div className="container">
        <div className="page-container">
          <div className="card">
            <h3>Restoring your vault...</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
        <div className="header">
            <h1>Integro Marketplace</h1>
            <p>The "DID Identity Layer" Demo</p>
        </div>
        <div className="page-container">
            <div className="card">
                <h3>Welcome to the Future of RWAs</h3>
                <p>Create a secure, seedless vault to manage your digital assets on Hedera.</p>
                <button onClick={handleCreateVault} className="hedera-button" disabled={isProcessing}>
                    {isProcessing ? 'Creating Vault...' : 'Create Your Secure Vault'}
                </button>
            </div>
            <div className="card">
                <h3>Connection Status</h3>
                <div className={`status-message ${status.includes('✅') ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
                    {status}
                </div>
            </div>
        </div>
    </div>
  );
};

export default LandingPage;
