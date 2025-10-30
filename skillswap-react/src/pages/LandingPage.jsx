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
    <div className="landing-container">
      <header className="landing-header">
        <div className="logo">Integro</div>
        <nav>
          <a href="#about">About Integro</a>
          <a href="#login">Login</a>
        </nav>
      </header>
      <main className="landing-main">
        <section className="hero">
          <h1>Africa’s informal economy runs on trust — but trust is fragile.</h1>
          <p>Integro builds the trust layer — connecting buyers, sellers, and agents on Hedera.</p>
          <button onClick={handleCreateVault} className="cta-button" disabled={isProcessing}>
            {isProcessing ? 'Creating Vault...' : 'Create your Secure Vault'}
          </button>
        </section>
        {/* Add more sections for storytelling as needed */}
      </main>
    </div>
  );
};

export default LandingPage;
