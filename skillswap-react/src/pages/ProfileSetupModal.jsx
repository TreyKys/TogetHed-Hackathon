import React, { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './ProfileSetupModal.css';

const ProfileSetupModal = ({ onProfileComplete }) => {
    const { accountId, refreshUserProfile } = useWallet();
    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSaveProfile = async () => {
        if (!accountId) {
            console.error("No account ID available to save profile.");
            return;
        }
        setIsProcessing(true);
        try {
            const userDocRef = doc(db, 'users', accountId);
            await setDoc(userDocRef, {
                name,
                bio,
                profileCompleted: true,
                createdAt: new Date().toISOString()
            }, { merge: true });

            await refreshUserProfile(); // Refresh the user profile in the context
            onProfileComplete();
        } catch (error) {
            console.error("Failed to save profile:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Setup Your Profile</h2>
                <p>Welcome to Integro. Please set up your profile to continue.</p>
                <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="profile-input"
                />
                <textarea
                    placeholder="A brief bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="profile-textarea"
                />
                <button onClick={handleSaveProfile} disabled={isProcessing} className="save-button">
                    {isProcessing ? 'Saving...' : 'Save and Continue'}
                </button>
            </div>
        </div>
    );
};

export default ProfileSetupModal;
