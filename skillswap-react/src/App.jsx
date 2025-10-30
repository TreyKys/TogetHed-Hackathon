import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext.jsx';
import Marketplace from './pages/Marketplace.jsx';
import './App.css';

import LandingPage from './pages/LandingPage.jsx';
import ProfileSetup from './pages/ProfileSetup.jsx';
import CreateListing from './pages/CreateListing.jsx';
import MyAssets from './pages/MyAssets.jsx';
import LendingPool from './pages/LendingPool.jsx';
import AgentStaking from './pages/AgentStaking.jsx';
import Layout from './components/Layout.jsx';

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
  const { accountId, isLoaded } = useWallet();
  console.log("AppContent: Rendering with accountId:", accountId, "and isLoaded:", isLoaded);

  if (!isLoaded) {
    return <div className="loading-container">Restoring your vault...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={!accountId ? <LandingPage /> : <Navigate to="/marketplace" />} />
      <Route path="/*" element={accountId ? <ProtectedRoutes /> : <Navigate to="/" />} />
    </Routes>
  );
}

const ProtectedRoutes = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/create-listing" element={<CreateListing />} />
        <Route path="/my-assets" element={<MyAssets />} />
        <Route path="/lending-pool" element={<LendingPool />} />
        <Route path="/agent-staking" element={<AgentStaking />} />
        {/* Add other protected routes here */}
        <Route path="*" element={<Navigate to="/marketplace" />} />
      </Routes>
    </Layout>
  );
};

export default App;
