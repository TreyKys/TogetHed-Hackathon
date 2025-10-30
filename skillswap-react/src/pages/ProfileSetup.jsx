import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletContext } from '../context/WalletContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const ProfileSetup = () => {
  const { accountId } = useContext(WalletContext);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('Buyer');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accountId) return alert('No account found. Please create a vault first.');

    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', accountId);
      await setDoc(userDocRef, { name, age, role, phone });
      navigate('/marketplace');
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <h2>Complete Your Profile</h2>
      <p>Before you can access the marketplace, please tell us a bit about yourself.</p>
      <form onSubmit={handleSubmit} className="profile-setup-form">
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="age">Age</label>
          <input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="role">I am a...</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option>Buyer</option>
            <option>Seller</option>
            <option>Agent</option>
            <option>Delivery Agent</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <button type="submit" className="hedera-button" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save & Enter Marketplace'}
        </button>
      </form>
    </div>
  );
};

export default ProfileSetup;
