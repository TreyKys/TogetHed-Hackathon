import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import './ProfileSetupModal.css';

const setUserProfileUrl = "https://us-central1-integro-ecosystem.cloudfunctions.net/setUserProfile";

const ProfileSetupModal = ({ onProfileComplete }) => {
    const { accountId, refreshUserProfile } = useWallet();
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

            await refreshUserProfile();

            setStatus('✅ Profile saved successfully!');
            onProfileComplete();
        } catch (error) {
            console.error('Profile setup failed:', error);
            setStatus(`❌ Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="profile-setup-modal-overlay">
            <div className="profile-setup-modal-content">
                <h2>Set Up Your Profile</h2>
                <p>Welcome to Integro! Let's get your profile ready for the marketplace.</p>

                <form onSubmit={handleSaveProfile}>
                    <div>
                    <label htmlFor="displayName">Display Name</label>
                    <input
                        type="text"
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="role">Your Role</label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                    >
                        <option value="" disabled>Select a role...</option>
                        <option value="Producer/Vendor">Producer/Vendor</option>
                        <option value="Service Provider">Service Provider</option>
                        <option value="Delivery Agent">Delivery Agent</option>
                        <option value="Client/Customer">Client/Customer</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="location">Location</label>
                    <input
                        type="text"
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" disabled={isProcessing}>
                    {isProcessing ? 'Saving...' : 'Save and Enter Marketplace'}
                </button>
            </form>
            {status && <p className={`status-message ${status.includes('❌') ? 'error' : ''}`}>{status}</p>}
            </div>
        </div>
    );
};

export default ProfileSetupModal;
