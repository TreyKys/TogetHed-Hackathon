import React, { useContext, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { WalletContext, WalletProvider } from './context/WalletContext';
import LandingPage from './pages/LandingPage';
import Marketplace from './pages/Marketplace';
import ProfilePage from './pages/ProfilePage';
import SellPage from './pages/SellPage';
import Header from './components/Header';
import Footer from './components/Footer';
import NavMenu from './components/NavMenu';
import './App.css';

// Placeholder pages for routes
const PlaceholderPage = ({ title }) => (
  <div className="page-container">
    <h2>{title}</h2>
    <p>Coming soon...</p>
  </div>
);

function App() {
  const { signer } = useContext(WalletContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className={`app-container ${isMenuOpen ? 'menu-open' : ''}`}>
      {signer && <Header toggleMenu={toggleMenu} />}
      {signer && <NavMenu />}
      <main>
        <Routes>
          <Route path="/" element={!signer ? <LandingPage /> : <Navigate to="/marketplace" />} />
          <Route path="/marketplace" element={signer ? <Marketplace /> : <Navigate to="/" />} />
          <Route path="/profile" element={signer ? <ProfilePage /> : <Navigate to="/" />} />
          <Route path="/sell" element={signer ? <SellPage /> : <Navigate to="/" />} />
          {/* Placeholder routes */}
          <Route path="/finance" element={signer ? <PlaceholderPage title="Finance" /> : <Navigate to="/" />} />
          <Route path="/logistics" element={signer ? <PlaceholderPage title="Logistics" /> : <Navigate to="/" />} />
          <Route path="/agents" element={signer ? <PlaceholderPage title="Become an Agent" /> : <Navigate to="/" />} />
          <Route path="/ussd" element={signer ? <PlaceholderPage title="USSD Simulator" /> : <Navigate to="/" />} />
          <Route path="/about" element={signer ? <PlaceholderPage title="About Integro" /> : <Navigate to="/" />} />
        </Routes>
      </main>
      {signer && <Footer />}
    </div>
  );
}


function MainApp() {
  return (
    <WalletProvider>
      <Router>
        <App />
      </Router>
    </WalletProvider>
  );
}

export default MainApp;
