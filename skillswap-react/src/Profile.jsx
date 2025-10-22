import React, { useState } from 'react';
import './Profile.css';

const Profile = ({ accountId, onProfileSave, setStatus }) => {
  const [displayName, setDisplayName] = useState('');
  const [roles, setRoles] = useState({
    producer: false,
    serviceProvider: false,
    deliveryAgent: false,
    client: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleRoleChange = (e) => {
    setRoles({ ...roles, [e.target.name]: e.target.checked });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus('⏳ Saving profile...');
    const selectedRoles = Object.keys(roles).filter(role => roles[role]);
    const profileData = {
      accountId,
      displayName,
      roles: selectedRoles,
    };

    try {
      // Replace with the actual backend URL
      const response = await fetch('YOUR_SET_USER_PROFILE_FUNCTION_URL', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile.');
      }

      const result = await response.json();
      console.log('Profile saved successfully:', result);
      setStatus('✅ Profile saved successfully!');
      onProfileSave(profileData);
    } catch (error) {
      console.error('Error saving profile:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-container">
      <h2>User Profile</h2>
      <div className="profile-form">
        <input
          type="text"
          placeholder="Enter Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="display-name-input"
        />
        <div className="roles-checkboxes">
          <label><input type="checkbox" name="producer" checked={roles.producer} onChange={handleRoleChange} /> Producer/Vendor</label>
          <label><input type="checkbox" name="serviceProvider" checked={roles.serviceProvider} onChange={handleRoleChange} /> Service Provider</label>
          <label><input type="checkbox" name="deliveryAgent" checked={roles.deliveryAgent} onChange={handleRoleChange} /> Delivery Agent</label>
          <label><input type="checkbox" name="client" checked={roles.client} onChange={handleRoleChange} /> Client/Customer</label>
        </div>
        <button onClick={handleSave} className="save-profile-button" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
};

export default Profile;