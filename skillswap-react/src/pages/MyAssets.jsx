import React from 'react';
import { useWallet } from '../context/WalletContext.jsx';
// We can create a separate CSS file for this component later if needed.

const MyAssets = () => {
    const { assetTokenIdState, nftSerialNumber } = useWallet();

    return (
        <div className="my-assets-container" style={{ fontFamily: '"Bricolage Grotesque", sans-serif', maxWidth: '500px', margin: '50px auto', padding: '2rem', backgroundColor: 'white', borderRadius: '15px' }}>
            <h2>My Assets</h2>
            {assetTokenIdState && nftSerialNumber ? (
                <div className="asset-card">
                    <h3>Your Newly Minted RWA</h3>
                    <p><strong>Token ID:</strong> {assetTokenIdState}</p>
                    <p><strong>Serial Number:</strong> {nftSerialNumber}</p>
                    {/* In the future, we can add more details here by fetching them from the mirror node */}
                </div>
            ) : (
                <p>You do not own any assets yet. Mint one from the marketplace!</p>
            )}
        </div>
    );
};

export default MyAssets;
