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

  // We wait until the wallet has been checked from localStorage before rendering.
  if (!isLoaded) {
    return <div>Loading...</div>; // Or a proper spinner component
  }

  return (
    <Routes>
      <Route
        path="/"
        element={accountId ? <Navigate to="/profile-setup" /> : <LandingPage />}
      />
      <Route
        path="/marketplace"
        element={accountId ? <Marketplace /> : <Navigate to="/" />}
      />
      <Route
        path="/profile-setup"
        element={accountId ? <ProfileSetup /> : <Navigate to="/" />}
      />
      <Route
        path="/create-listing"
        element={accountId ? <CreateListing /> : <Navigate to="/" />}
      />
      <Route
        path="/my-assets"
        element={accountId ? <MyAssets /> : <Navigate to="/" />}
      />
      <Route
        path="/lending-pool"
        element={accountId ? <LendingPool /> : <Navigate to="/" />}
      />
      <Route
        path="/agent-staking"
        element={accountId ? <AgentStaking /> : <Navigate to="/" />}
      />
      {/* Redirect any other path to the root */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
