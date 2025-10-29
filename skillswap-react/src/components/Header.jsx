import React from 'react';
import './Layout.css'; // We will create this CSS file next

// Placeholder for a hamburger icon
const HamburgerIcon = () => (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 22.5H25" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 15H25" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 7.5H25" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


const Header = ({ onMenuClick }) => {
    return (
        <header className="main-header">
            <div className="logo">
                {/* Replace with the actual path to your logo */}
                <img src="/src/assets/integro-logo.png" alt="Integro Logo" style={{ height: '40px' }} />
            </div>
            <div className="search-bar">
                <input type="text" placeholder="Search the marketplace..." />
            </div>
            <div className="menu-icon" onClick={onMenuClick}>
                <HamburgerIcon />
            </div>
        </header>
    );
};

export default Header;
