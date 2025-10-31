import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import { db } from '../firebase.js';
import { collection, query, where, getDocs } from 'firebase/firestore';
import BackButton from '../components/BackButton.jsx';
import { assetTokenId } from '../hedera.js';
import './MyAssets.css';

// Function to decode base64 metadata
const decodeMetadata = (base64) => {
    try {
        const json = atob(base64);
        return JSON.parse(json);
    } catch (e) {
        console.error("Failed to parse metadata:", e);
        return {};
    }
};

import Toast from '../components/Toast.jsx';

const MyAssets = () => {
    const { accountId, handleConfirmDelivery } = useWallet();
    const [assets, setAssets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(null); // Tracks the serial number of the asset being confirmed
    const [toast, setToast] = useState({ show: false, message: '', txHash: '' });

    const handleConfirmClick = async (serialNumber) => {
        setIsConfirming(serialNumber);
        try {
            const txResponse = await handleConfirmDelivery(serialNumber);
            setToast({
                show: true,
                message: `Delivery confirmed for asset #${serialNumber}!`,
                txHash: txResponse.transactionId.toString(),
            });
            // Optimistically update the UI or refetch assets
            setAssets(prevAssets => prevAssets.map(asset =>
                asset.serialNumber === serialNumber ? { ...asset, status: 'Sold' } : asset
            ));
        } catch (error) {
            console.error("Failed to confirm delivery:", error);
            setToast({ show: true, message: `Confirmation Failed: ${error.message}` });
        } finally {
            setIsConfirming(null);
        }
    };

    useEffect(() => {
        const fetchAssets = async () => {
            console.log("MyAssets useEffect triggered");
            if (!accountId) return;
            setIsLoading(true);
            try {
                // 1. Fetch NFTs the user OWNS from Hedera Mirror Node
                const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts?token.id=${assetTokenId}`;
                const response = await fetch(mirrorNodeUrl);
                if (!response.ok) throw new Error(`Failed to fetch from mirror node: ${response.statusText}`);
                const data = await response.json();
                const userNfts = data.nfts || [];

                // 2. Fetch listing data from Firestore to enrich the owned NFTs
                const listingsRef = collection(db, "listings");
                const sellerQuery = query(listingsRef, where("sellerAccountId", "==", accountId));
                const sellerSnapshot = await getDocs(sellerQuery);
                const listingStatuses = {};
                sellerSnapshot.forEach(doc => {
                    const docData = doc.data();
                    listingStatuses[docData.serialNumber] = docData.status || 'Listed';
                });

                const ownedAssets = userNfts.map(nft => {
                    const metadata = decodeMetadata(nft.metadata);
                    return {
                        id: `${nft.token_id}-${nft.serial_number}`,
                        serialNumber: nft.serial_number,
                        name: metadata.name || 'Untitled Asset',
                        description: metadata.description || 'No description.',
                        imageUrl: metadata.image || 'https://via.placeholder.com/150',
                        status: listingStatuses[nft.serial_number] || 'In Wallet',
                        isOwner: true,
                    };
                });

                // 3. Fetch assets the user has PURCHASED but not yet received
                const buyerQuery = query(listingsRef, where("buyerAccountId", "==", accountId), where("status", "==", "Pending Delivery"));
                const buyerSnapshot = await getDocs(buyerQuery);
                const purchasedAssets = buyerSnapshot.docs.map(doc => {
                    const docData = doc.data();
                    return {
                        id: doc.id,
                        serialNumber: docData.serialNumber,
                        name: docData.name,
                        description: docData.description,
                        imageUrl: docData.imageUrl,
                        status: docData.status,
                        isOwner: false,
                    };
                });

                // 4. Combine and set state, ensuring no duplicates
                const allAssets = [...ownedAssets, ...purchasedAssets];
                const uniqueAssets = allAssets.filter((asset, index, self) =>
                    index === self.findIndex((a) => a.serialNumber === asset.serialNumber)
                );

                setAssets(uniqueAssets);
            } catch (error) {
                console.error("Failed to fetch assets:", error);
                setAssets([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssets();
    }, [accountId]);

    return (
        <div className="my-assets-container">
            {toast.show && <Toast message={toast.message} txHash={toast.txHash} onClose={() => setToast({ show: false, message: '', txHash: '' })} />}
            <BackButton />
            <h2>My Digital Assets</h2>
            {isLoading && <p>Loading your assets from the Hedera network...</p>}
            {!isLoading && assets.length > 0 ? (
                <div className="assets-grid">
                    {assets.map(asset => (
                        <div key={asset.id} className="asset-card">
                            <img src={asset.imageUrl} alt={asset.name} className="asset-image" />
                            <div className="asset-info">
                                <h3>{asset.name}</h3>
                                <p className="asset-serial">Serial: {asset.serialNumber}</p>
                                <div className="asset-status-wrapper">
                                    <span className={`status-badge status-${asset.status.toLowerCase().replace(' ', '-')}`}>
                                        {asset.status}
                                    </span>
                                    {asset.status === 'Pending Delivery' && !asset.isOwner && (
                                        <button
                                            onClick={() => handleConfirmClick(asset.serialNumber)}
                                            className="confirm-delivery-button"
                                            disabled={isConfirming === asset.serialNumber}
                                        >
                                            {isConfirming === asset.serialNumber ? 'Confirming...' : 'Confirm Delivery'}
                                        </button>
                                    )}
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
