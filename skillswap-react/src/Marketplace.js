import React from 'react';
import './Marketplace.css'; // Make sure this CSS file exists

// Placeholder image (replace with an actual image URL later)
const yamImage = 'https://via.placeholder.com/150/2DD87F/000000?text=Yam+Harvest';

// Example RWA data (hard-coded for the demo)
const rwaItems = [
  {
    id: 1,
    tokenId: 'DUMMY_TOKEN_ID_1', // Placeholder Token ID
    name: 'Yam Harvest Future (Grade A)',
    location: 'Ikorodu Farms, Lagos', // Added Lagos
    seller: '0x123...abc', // Placeholder seller address
    price: 50, // Price in HBAR
    image: yamImage,
  },
  {
    id: 2,
    tokenId: 'DUMMY_TOKEN_ID_2', // Placeholder Token ID
    name: 'Artisan Craftwork Batch #3',
    location: 'Lagos Market',
    seller: '0x456...def',
    price: 120,
    image: 'https://via.placeholder.com/150/AAAAAA/000000?text=Crafts',
  },
   {
    id: 3,
    tokenId: 'DUMMY_TOKEN_ID_3', // Placeholder Token ID
    name: 'Fresh Fish Catch (Tilapia)',
    location: 'Ikorodu Fish Market', // Added more local context
    seller: '0x789...ghi',
    price: 35,
    image: 'https://via.placeholder.com/150/4682B4/FFFFFF?text=Fish',
  },
   {
    id: 4,
    tokenId: 'DUMMY_TOKEN_ID_4', // Placeholder Token ID
    name: 'Handwoven Aso Oke Fabric',
    location: 'Local Weaver, Lagos',
    seller: '0xABC...jkl',
    price: 250,
    image: 'https://via.placeholder.com/150/D2691E/FFFFFF?text=Fabric',
  },
];

// This is the function that will eventually call our smart contract
// For now, it just shows an alert
const handleBuyClick = (item) => {
  console.log("Attempting to buy:", item); // Log item details for debugging
  alert(`Initiating purchase for ${item.name} (Token ID: ${item.tokenId}) for ${item.price} HBAR...`);
  // TODO: In the final version, this will call the handleBuy (fundEscrow) function from App.jsx
  // We'll need to pass the actual tokenId and potentially load the price from the contract
};

function Marketplace() {
  return (
    <div className="marketplace-container card"> {/* Added card class */}
      <h2>RWA Marketplace</h2>
      <p>Browse available tokenized assets from local producers.</p>
      <div className="item-list">
        {rwaItems.map((item) => (
          <div key={item.id} className="item-card">
            <img src={item.image} alt={item.name} className="item-image" />
            <h4 className="item-name">{item.name}</h4>
            <p className="item-detail">Location: {item.location}</p>
            {/* <p className="item-detail">Seller: {item.seller.slice(0, 6)}...</p> */}
            <p className="item-price">{item.price} HBAR</p>
            <button
              onClick={() => handleBuyClick(item)}
              className="hedera-button buy-button"
            >
              Buy Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Marketplace;

