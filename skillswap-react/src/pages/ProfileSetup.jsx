import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletContext } from '../context/WalletContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const ProfileSetup = () => {
  const { accountId } = useContext(WalletContext);
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId) {
      alert('No account found. Please create a vault first.');
      return;
    }
    if (!role) {
      alert('Please select a role.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', accountId);
      await setDoc(userDocRef, { name: displayName, role, location });
      navigate('/marketplace');
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f7f7f7',
    fontFamily: 'Arial, sans-serif'
  };

  const cardStyle = {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center'
  };

  const titleStyle = {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333'
  };

  const subtitleStyle = {
    fontSize: '16px',
    color: '#666',
    marginBottom: '32px'
  };

  const formGroupStyle = {
    marginBottom: '24px',
    textAlign: 'left'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    color: '#333',
    fontWeight: 'bold'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#eee',
    fontSize: '16px'
  };

  const selectStyle = {
    ...inputStyle,
    color: role ? '#333' : '#888'
  };

  const buttonStyle = {
    width: '100%',
    padding: '16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#00C853',
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '16px'
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>Set Up Your Profile</h2>
        <p style={subtitleStyle}>Your secure vault is created. Now, let's set up your public profile.</p>
        <form onSubmit={handleSubmit}>
          <div style={formGroupStyle}>
            <label htmlFor="displayName" style={labelStyle}>Display Name</label>
            <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} required />
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="role" style={labelStyle}>Your Role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle} required>
              <option value="" disabled>Select a role...</option>
              <option value="Buyer">Buyer</option>
              <option value="Seller">Seller</option>
              <option value="Agent">Agent</option>
              <option value="Delivery Agent">Delivery Agent</option>
            </select>
          </div>
          <div style={formGroupStyle}>
            <label htmlFor="location" style={labelStyle}>Location</label>
            <input id="location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} required />
          </div>
          <button type="submit" style={buttonStyle} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save and Enter Marketplace'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetup;
