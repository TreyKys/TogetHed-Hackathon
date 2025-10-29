import React from 'react';
import { Link } from 'react-router-dom';
import './Layout.css'; // Using the same CSS file for layout components

// Minimalist SVG Icons
const EcosystemIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>;
const AssetsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>;
const LendingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const StakingIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>;
const AboutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;


const Sidebar = ({ isOpen, onClose }) => {
    return (
        <>
            <div className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h3>Menu</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <nav className="sidebar-nav">
                    <ul>
                        <li><Link to="/marketplace"><EcosystemIcon /> Ecosystem</Link></li>
                        <li><Link to="/my-assets"><AssetsIcon /> My Assets</Link></li>
                        <li><Link to="/lending-pool"><LendingIcon /> Lending Pool</Link></li>
                        <li><Link to="/agent-staking"><StakingIcon /> Agent Staking</Link></li>
                        <li><Link to="/#about"><AboutIcon /> About Integro</Link></li>
                    </ul>
                </nav>
                <div className="sidebar-footer">
                    <p>Building the Trust Layer for Africa's Informal Economy</p>
                </div>
            </div>
            {isOpen && <div className="overlay" onClick={onClose}></div>}
        </>
    );
};

export default Sidebar;
