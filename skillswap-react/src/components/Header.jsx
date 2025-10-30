import React from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import './Layout.css';

const HamburgerIcon = () => (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 22.5H25" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 15H25" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 7.5H25" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const Header = ({ onMenuClick }) => {
    const { accountId, evmAddress, hbarBalance } = useWallet();

    const shortenAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 5)}...${address.substring(address.length - 4)}`;
    }

    return (
        <header className="main-header">
            <div className="logo">
                <img src="/src/assets/integro-logo.png" alt="Integro Logo" style={{ height: '40px' }} />
            </div>

            <div className="wallet-info">
                <div>
                    <span>Account ID</span>
                    <strong>{accountId || '...'}</strong>
                </div>
                <div>
                    <span>EVM Address</span>
                    <strong>{shortenAddress(evmAddress) || '...'}</strong>
                </div>
                <div>
                    <span>Balance</span>
                    <strong>{hbarBalance ? `${hbarBalance} ℏ` : 'Loading...'}</strong>
                </div>
            </div>

            <div className="menu-icon" onClick={onMenuClick}>
                <HamburgerIcon />
            </div>
        </header>
    );
};

export default Header;
