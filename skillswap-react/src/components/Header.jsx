import React from 'react';
import { Link } from 'react-router-dom';
import WalletInfo from './WalletInfo';

const Header = ({ toggleMenu }) => {
  return (
    <header className="app-header">
      <button onClick={toggleMenu} className="menu-toggle">
        &#9776;
      </button>
      <div className="logo">
        <Link to="/marketplace">Integro</Link>
      </div>
      <WalletInfo />
    </header>
  );
};

export default Header;
