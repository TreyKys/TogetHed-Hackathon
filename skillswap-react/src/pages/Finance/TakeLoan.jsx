import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext.jsx';
import BackButton from '../../components/BackButton.jsx';
import { assetTokenId } from '../../hedera.js';
import './Lending.css';

const TakeLoan = () => {
    const { accountId, callTakeLoan } = useWallet();
    const [assets, setAssets] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState('');
    const [principal, setPrincipal] = useState('');
    const [interest, setInterest] = useState('');
    const [duration, setDuration] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState('');

    useEffect(() => {
        const fetchAssets = async () => {
            if (!accountId) return;
            setIsLoading(true);
            try {
                const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?token.id=${assetTokenId}`;
                const response = await fetch(mirrorNodeUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch from mirror node: ${response.statusText}`);
                }
                const data = await response.json();
                setAssets(data.nfts || []);
            } catch (error) {
                console.error("Failed to fetch assets:", error);
                setAssets([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssets();
    }, [accountId]);

    const navigate = useNavigate();
    const handleTakeLoan = async (e) => {
        e.preventDefault();
        setStatus('Processing...');
        try {
            const durationSeconds = duration * 24 * 60 * 60;
            const receipt = await callTakeLoan(selectedAsset, principal, interest, durationSeconds);
            if (receipt.status.toString() === 'SUCCESS') {
                setStatus('Loan taken successfully!');
                navigate('/my-loans');
            } else {
                setStatus('Error taking loan.');
            }
        } catch (error) {
            setStatus('Error taking loan.');
            console.error(error);
        }
    };

    return (
        <div className="take-loan-container">
            <BackButton />
            <h2>Take a Loan</h2>
            {isLoading ? (
                <p>Loading your assets...</p>
            ) : (
                <form onSubmit={handleTakeLoan}>
                    <div className="form-group">
                        <label>Select Asset</label>
                        <select onChange={(e) => setSelectedAsset(e.target.value)} required>
                            <option value="">Select your NFT</option>
                            {assets.map(asset => (
                                <option key={asset.serial_number} value={asset.serial_number}>
                                    Serial: {asset.serial_number}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Principal (HBAR)</label>
                        <input
                            type="number"
                            value={principal}
                            onChange={(e) => setPrincipal(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Interest (HBAR)</label>
                        <input
                            type="number"
                            value={interest}
                            onChange={(e) => setInterest(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Duration (days)</label>
                        <input
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit">Take Loan</button>
                </form>
            )}
            {status && <p>{status}</p>}
        </div>
    );
};

export default TakeLoan;
