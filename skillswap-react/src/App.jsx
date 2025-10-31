import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext.jsx';
import Marketplace from './pages/Marketplace.jsx';
import ProfileSetupModal from './pages/ProfileSetupModal.jsx';
import './App.css';

import LandingPage from './pages/LandingPage.jsx';
import CreateListing from './pages/CreateListing.jsx';
import MyAssets from './pages/MyAssets.jsx';
import LendingPool from './pages/LendingPool.jsx';
import AgentStaking from './pages/AgentStaking.jsx';
import Layout from './components/Layout.jsx';
import LendingPoolOverview from './pages/Finance/LendingPoolOverview.jsx';
import TakeLoan from './pages/Finance/TakeLoan.jsx';
import MyLoans from './pages/Finance/MyLoans.jsx';
import DepositLiquidity from './pages/Finance/DepositLiquidity.jsx';
import RepayLoan from './pages/Finance/RepayLoan.jsx';

function App() {
  return (
    <WalletProvider>
      <Router>
        <AppContent />
      </Router>
    </WalletProvider>
  );
}

function AppContent() {
  const { accountId, userProfile, isLoaded, status } = useWallet();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    if (isLoaded && accountId && (!userProfile || !userProfile.profileCompleted)) {
      const localFlag = localStorage.getItem('integro-profile-completed');
      if (localFlag !== 'true') {
        setProfileModalOpen(true);
      }
    } else {
      setProfileModalOpen(false);
    }
  }, [isLoaded, accountId, userProfile]);

  if (!isLoaded) {
    return <div className="loading-container">{status}</div>;
  }

  const handleProfileComplete = () => {
    setProfileModalOpen(false);
    localStorage.setItem('integro-profile-completed', 'true');
  };

  return (
    <>
      {profileModalOpen && <ProfileSetupModal onProfileComplete={handleProfileComplete} />}
      <Routes>
        <Route path="/" element={!accountId ? <LandingPage /> : <Navigate to="/marketplace" />} />
        <Route
          path="/*"
          element={accountId ? <ProtectedRoutes /> : <Navigate to="/" />}
        />
      </Routes>
    </>
  );
}

const ProtectedRoutes = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/create-listing" element={<CreateListing />} />
        <Route path="/my-assets" element={<MyAssets />} />
        <Route path="/lending-pool" element={<Navigate to="/lending-pool-overview" />} />
        <Route path="/lending-pool-overview" element={<LendingPoolOverview />} />
        <Route path="/take-loan" element={<TakeLoan />} />
        <Route path="/my-loans" element={<MyLoans />} />
        <Route path="/deposit-liquidity" element={<DepositLiquidity />} />
        <Route path="/repay-loan" element={<RepayLoan />} />
        <Route path="/agent-staking" element={<AgentStaking />} />
        {/* Add other protected routes here */}
        <Route path="*" element={<Navigate to="/marketplace" />} />
      </Routes>
    </Layout>
  );
};

export default App;
