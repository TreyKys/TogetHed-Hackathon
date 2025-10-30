import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import BackButton from '../components/BackButton.jsx';

const MyAssets = () => {
    const { accountId, nftSerialNumber } = useWallet();
    const [assets, setAssets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAssets = async () => {
            if (!accountId) return;
            setIsLoading(true);
            try {
                // In a real application, you would fetch the user's assets from a mirror node or a database.
                // For this example, we'll just display the most recently minted asset.
                if (nftSerialNumber) {
                    setAssets([{ serialNumber: nftSerialNumber, name: 'My Minted RWA' }]);
                }
            } catch (error) {
                console.error("Failed to fetch assets:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssets();
    }, [accountId, nftSerialNumber]);

    return (
        <div className="my-assets-container">
            <BackButton />
            <h2>My Assets</h2>
            {isLoading ? (
                <p>Loading assets...</p>
            ) : assets.length > 0 ? (
                <div className="assets-grid">
                    {assets.map(asset => (
                        <div key={asset.serialNumber} className="asset-card">
                            <h3>{asset.name}</h3>
                            <p>Serial Number: {asset.serialNumber}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p>You don't have any assets yet.</p>
            )}
        </div>
    );
};

export default MyAssets;
