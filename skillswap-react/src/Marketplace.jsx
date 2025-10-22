import React from 'react';
import './Marketplace.css';

const Marketplace = ({ handleBuy }) => {
  // Placeholder data for marketplace items
  const items = [
    { id: 1, name: 'Yam Harvest Future', price: '50 HBAR', image: 'https://via.placeholder.com/150' },
    { id: 2, name: 'Artisanal Coffee Beans', price: '25 HBAR', image: 'https://via.placeholder.com/150' },
    { id: 3, name: 'Handwoven Basket', price: '30 HBAR', image: 'https://via.placeholder.com/150' },
  ];

  return (
    <div className="marketplace-container">
      <h2>Marketplace</h2>
      <div className="marketplace-grid">
        {items.map(item => (
          <div key={item.id} className="marketplace-item">
            <img src={item.image} alt={item.name} />
            <h3>{item.name}</h3>
            <p>{item.price}</p>
            <button onClick={() => handleBuy(item.id)} className="buy-now-button">Buy Now</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Marketplace;