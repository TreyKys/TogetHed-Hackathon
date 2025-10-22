import React, { useState } from 'react';
import './Navigation.css';

const Navigation = ({ setView }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (view) => {
    setView(view);
    setIsOpen(false);
  };

  return (
    <div className="navigation-container">
      <button className="hamburger-menu" onClick={toggleMenu}>
        &#9776;
      </button>
      <div className={`navigation-overlay ${isOpen ? 'open' : ''}`} onClick={toggleMenu}></div>
      <div className={`navigation-menu ${isOpen ? 'open' : ''}`}>
        <button className="close-button" onClick={toggleMenu}>&times;</button>
        <ul>
          <li onClick={() => handleNavigation('MAIN')}>Vault/Golden Path</li>
          <li onClick={() => handleNavigation('MARKETPLACE')}>Marketplace</li>
          <li onClick={() => handleNavigation('PROFILE')}>Profile</li>
          <li onClick={() => handleNavigation('LENDING')}>Lending Pool</li>
          <li onClick={() => handleNavigation('STAKING')}>Agent Staking</li>
        </ul>
      </div>
    </div>
  );
};

export default Navigation;