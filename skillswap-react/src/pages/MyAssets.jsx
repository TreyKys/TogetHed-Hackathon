import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import { db } from '../firebase.js';
import { collection, query, where, getDocs } from 'firebase/firestore';
import BackButton from '../components/BackButton.jsx';
import { assetTokenId } from '../hedera.js';
import './MyAssets.css';

const MyAssets = () => {
    const { accountId } = useWallet();
    const [assets, setAssets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAssets = async () => {
            if (!accountId) return;
            setIsLoading(true);
            try {
                // 1. Fetch listing data from Firestore
                const listingsRef = collection(db, "listings");
                const q = query(listingsRef, where("sellerAccountId", "==", accountId));
                const querySnapshot = await getDocs(q);
                const firestoreAssets = {};
                querySnapshot.forEach(doc => {
                    const docData = doc.data();
                    firestoreAssets[docData.serial] = {
                        name: docData.name,
                        description: docData.description,
                        imageUrl: docData.imageUrl,
                        status: docData.state || 'In Wallet'
                    };
                });

                // 2. Fetch NFTs from Hedera Mirror Node
                const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?token.id=${assetTokenId}`;
                const response = await fetch(mirrorNodeUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch from mirror node: ${response.statusText}`);
                }
                const data = await response.json();
                const userNfts = data.nfts || [];


                // 3. Combine data and set state
                const combinedAssets = userNfts.map(nft => {
                    const firestoreData = firestoreAssets[nft.serial_number] || {};
                    return {
                        serialNumber: nft.serial_number,
                        name: firestoreData.name || 'Untitled Asset',
                        description: firestoreData.description || 'No description.',
                        imageUrl: firestoreData.imageUrl || 'https://via.placeholder.com/150',
                        status: firestoreData.status || 'In Wallet',
                    };
                });

                setAssets(combinedAssets);
            } catch (error) {
                console.error("Failed to fetch assets:", error);
                setAssets([]); // Clear assets on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssets();
    }, [accountId]);

    return (
        <div className="my-assets-container">
            <BackButton />
            <h2>My Digital Assets</h2>
            {isLoading ? (
                <p>Loading your assets from the Hedera network...</p>
            ) : assets.length > 0 ? (
                <div className="assets-grid">
                    {assets.map(asset => (
                        <div key={asset.serialNumber} className="asset-card">
                            <img src={asset.imageUrl} alt={asset.name} className="asset-image" />
                            <div className="asset-info">
                                <h3>{asset.name}</h3>
                                <p className="asset-serial">Serial: {asset.serialNumber}</p>
                                <div className="asset-status-wrapper">
                                    <span className={`status-badge status-${asset.status.toLowerCase().replace(' ', '-')}`}>
                                        {asset.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="no-assets-container">
                    <p>You haven't minted any assets yet.</p>
                    <p>Visit the Marketplace to create your first digital asset.</p>
                </div>
            )}
        </div>
    );
};

export default MyAssets;
