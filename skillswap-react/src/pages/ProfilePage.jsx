import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../context/WalletContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import BackButton from '../components/BackButton';

const ProfilePage = () => {
  const { accountId } = useContext(WalletContext);
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!accountId) return;

      const userDocRef = doc(db, 'users', accountId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
      setIsLoading(false);
    };

    const fetchUserNfts = async () => {
      if (!accountId) return;
      // Note: This is a simplified example. A real implementation would need to handle pagination.
      const nftApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts`;
      try {
        const response = await fetch(nftApiUrl);
        const data = await response.json();
        setUserNfts(data.nfts || []);
      } catch (error) {
        console.error("Failed to fetch user NFTs:", error);
      }
    };

    fetchUserProfile();
    fetchUserNfts();
  }, [accountId]);

  return (
    <div className="page-container">
      <BackButton />
      <h2>User Profile</h2>
      {isLoading ? (
        <p>Loading profile...</p>
      ) : userProfile ? (
        <div className="profile-details">
          <p><strong>Name:</strong> {userProfile.name}</p>
          <p><strong>Age:</strong> {userProfile.age}</p>
          <p><strong>Role:</strong> {userProfile.role}</p>
          <p><strong>Phone:</strong> {userProfile.phone}</p>
          <button className="hedera-button">Edit Profile</button>
        </div>
      ) : (
        <p>No profile data found. Please complete your profile.</p>
      )}

      <div className="nft-collection">
        <h3>My NFTs</h3>
        {userNfts.length > 0 ? (
          <div className="nfts-grid">
            {userNfts.map(nft => (
              <div key={`${nft.token_id}-${nft.serial_number}`} className="nft-card">
                <p><strong>Token ID:</strong> {nft.token_id}</p>
                <p><strong>Serial:</strong> {nft.serial_number}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>You don't own any NFTs yet.</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
