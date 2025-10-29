import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
// We can create a separate CSS file for this component later if needed.

const CreateListing = () => {
    const navigate = useNavigate();
    const { handleMint, handleList } = useWallet();
    const [assetType, setAssetType] = useState('');
    const [quality, setQuality] = useState('');
    const [location, setLocation] = useState('');
    const [price, setPrice] = useState('');
    const [status, setStatus] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleCreateListing = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        setStatus('Creating and listing your asset...');

        try {
            setStatus('1/2: Minting your asset...');
            await handleMint(assetType, quality, location);

            setStatus('2/2: Listing your asset...');
            await handleList(price);

            setStatus('✅ Asset listed successfully!');
            navigate('/marketplace');

        } catch (error) {
            console.error('Failed to create listing:', error);
            setStatus(`❌ Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="create-listing-container" style={{ fontFamily: '"Bricolage Grotesque", sans-serif', maxWidth: '500px', margin: '50px auto', padding: '2rem', backgroundColor: 'white', borderRadius: '15px' }}>
            <h2>List Your Product or Service</h2>
            <form onSubmit={handleCreateListing}>
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                    <label htmlFor="assetType" style={{ display: 'block', marginBottom: '5px' }}>What are you selling?</label>
                    <input
                        type="text"
                        id="assetType"
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                </div>
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                    <label htmlFor="quality" style={{ display: 'block', marginBottom: '5px' }}>Quality/Description</label>
                    <input
                        type="text"
                        id="quality"
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                </div>
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                    <label htmlFor="location" style={{ display: 'block', marginBottom: '5px' }}>Location</label>
                    <input
                        type="text"
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                </div>
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                    <label htmlFor="price" style={{ display: 'block', marginBottom: '5px' }}>Price (in HBAR)</label>
                    <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                </div>
                <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#008000', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }} disabled={isProcessing}>
                    {isProcessing ? 'Listing...' : 'Create & List'}
                </button>
            </form>
            {status && <p style={{ marginTop: '1rem', color: status.includes('✅') ? 'green' : 'black' }}>{status}</p>}
        </div>
    );
};

export default CreateListing;
