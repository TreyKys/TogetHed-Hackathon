import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
import './LandingPage.css';

const cloudFunctionUrl = "https://createaccount-cehqwvb4aq-uc.a.run.app";

const LandingPage = () => {
    const navigate = useNavigate();
    const { createVault } = useWallet();
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState('');

    const handleCreateVault = async () => {
        setIsProcessing(true);
        setStatus("1/2: Calling the secure Account Factory...");
        try {
            const response = await fetch(cloudFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Backend request failed.');
            }

            setStatus("2/2: Storing your secure credentials...");
            const { accountId, privateKey, evmAddress } = data;
            const normalizedPriv = privateKey.startsWith("0x") ? privateKey : "0x" + privateKey;

            // Use the context to save the vault
            createVault(accountId, normalizedPriv, evmAddress);
            navigate('/profile-setup');

        } catch (error) {
            console.error("Vault creation failed:", error);
            setStatus(`❌ Vault creation failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="landing-container">
            <header className="landing-header">
                {/* Replace with the actual path to your logo */}
                <img src="/src/assets/integro-logo.png" alt="Integro Logo" style={{ height: '40px' }} />
                <nav>
                    <a href="#features">Features</a>
                    <a href="#about">About</a>
                    <a href="#contact">Contact</a>
                </nav>
            </header>
            <main>
                <section className="hero-section">
                    <h1>The Trust Layer for Africa's Informal Economy</h1>
                    <p>Tokenize Real World Assets, from goods and services to community impact.</p>
                    <button onClick={handleCreateVault} className="cta-button" disabled={isProcessing}>
                        {isProcessing ? 'Creating Vault...' : 'Create Your Secure Vault'}
                    </button>
                    {status && <p className="status-message">{status}</p>}
                </section>
                {/* I will add more sections here for the scroll-driven narrative */}
            </main>
        </div>
    );
};

export default LandingPage;
