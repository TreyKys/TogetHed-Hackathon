import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext.jsx';
// We can create a separate CSS file for this component later if needed.

const setUserProfileUrl = "https://us-central1-integro-ecosystem.cloudfunctions.net/setUserProfile";

const ProfileSetup = () => {
    const navigate = useNavigate();
    const { accountId } = useWallet();
    const [displayName, setDisplayName] = useState('');
    const [role, setRole] = useState('');
    const [location, setLocation] = useState('');
    const [status, setStatus] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        setStatus('Saving profile...');

        try {
            const response = await fetch(setUserProfileUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId,
                    displayName,
                    role,
                    location,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save profile.');
            }

            setStatus('✅ Profile saved successfully!');
            navigate('/marketplace');

        } catch (error) {
            console.error('Profile setup failed:', error);
            setStatus(`❌ Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="profile-setup-container" style={{ fontFamily: '"Bricolage Grotesque", sans-serif', maxWidth: '500px', margin: '50px auto', padding: '2rem', backgroundColor: 'white', borderRadius: '15px' }}>
            <h2>Set Up Your Profile</h2>
            <p>Your secure vault is created. Now, let's set up your public profile.</p>

            <form onSubmit={handleSaveProfile}>
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                    <label htmlFor="displayName" style={{ display: 'block', marginBottom: '5px' }}>Display Name</label>
                    <input
                        type="text"
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />
                </div>
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                    <label htmlFor="role" style={{ display: 'block', marginBottom: '5px' }}>Your Role</label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    >
                        <option value="" disabled>Select a role...</option>
                        <option value="Producer/Vendor">Producer/Vendor</option>
                        <option value="Service Provider">Service Provider</option>
                        <option value="Delivery Agent">Delivery Agent</option>
                        <option value="Client/Customer">Client/Customer</option>
                    </select>
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
                <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#008000', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }} disabled={isProcessing}>
                    {isProcessing ? 'Saving...' : 'Save and Enter Marketplace'}
                </button>
            </form>
            {status && <p style={{ marginTop: '1rem', color: status.includes('✅') ? 'green' : 'black' }}>{status}</p>}
        </div>
    );
};

export default ProfileSetup;
