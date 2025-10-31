import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.jsx';
import Toast from '../components/Toast.jsx';
import './ProfilePage.css';

const ProfilePage = () => {
    const { userProfile, updateUserProfile } = useWallet();
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        bio: '',
    });
    const [toast, setToast] = useState({ show: false, message: '' });

    useEffect(() => {
        if (userProfile) {
            setFormData({
                name: userProfile.name || '',
                location: userProfile.location || '',
                bio: userProfile.bio || '',
            });
        }
    }, [userProfile]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({ ...prevState, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateUserProfile(formData);
            setToast({ show: true, message: 'Profile updated successfully!' });
        } catch (error) {
            setToast({ show: true, message: `Error updating profile: ${error.message}` });
        }
    };

    return (
        <div className="profile-page-container">
            {toast.show && <Toast message={toast.message} onClose={() => setToast({ show: false, message: '' })} />}
            <h1>User Profile</h1>
            <p>Complete your profile to get the most out of Integro.</p>
            <form onSubmit={handleSubmit} className="profile-form">
                <div className="form-group">
                    <label htmlFor="name">Name</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g., Jane Doe"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="location">Location</label>
                    <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g., Nairobi, Kenya"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="bio">Bio</label>
                    <textarea
                        id="bio"
                        name="bio"
                        value={formData.bio}
                        onChange={handleChange}
                        placeholder="Tell us a little about yourself and what you do."
                    />
                </div>
                <button type="submit" className="save-button">Save Profile</button>
            </form>
        </div>
    );
};

export default ProfilePage;
