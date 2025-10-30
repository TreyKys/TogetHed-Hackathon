import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WalletContext } from '../context/WalletContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import ListingCard from '../components/ListingCard';

const Marketplace = () => {
  const { status, handleBuy } = useContext(WalletContext);
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const listingsRef = collection(db, 'listings');
    const q = query(listingsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(listingsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <h1>Integro Marketplace</h1>
        <p>The "DID Identity Layer" Demo</p>
      </div>
      <div className="page-container">
        <div className="card">
          <h3>Connection Status</h3>
          <div className={`status-message ${status.includes('✅') ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {status}
          </div>
        </div>

        <div className="card">
            <h3>Live Marketplace</h3>
            <div className="button-group">
                <Link to="/sell" className="hedera-button">Sell your product/service</Link>
            </div>
            <div className="listings-grid">
              {isLoading && <p>Loading listings...</p>}
              {listings.map(listing => (
                <ListingCard key={listing.id} listing={listing} handleBuy={handleBuy} />
              ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
