import React, { useState, useContext } from 'react';
import { WalletContext } from '../context/WalletContext';
import BackButton from '../components/BackButton';

const SellPage = () => {
  const { handleMint, isTransactionLoading } = useContext(WalletContext);
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    handleMint({ productName, description, price });
  };

  return (
    <div className="page-container">
      <BackButton />
      <h2>Sell a Product or Service</h2>
      <form onSubmit={handleSubmit} className="sell-form">
        <div className="form-group">
          <label htmlFor="productName">Product Name</label>
          <input
            id="productName"
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="price">Price (in HBAR)</label>
          <input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="hedera-button" disabled={isTransactionLoading}>
          {isTransactionLoading ? 'Listing...' : 'Create Listing'}
        </button>
      </form>
    </div>
  );
};

export default SellPage;
