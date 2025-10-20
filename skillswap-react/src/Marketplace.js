import React from 'react';

// Example RWA data (hard-coded for the demo - showing diverse use cases)
const rwaItems = [
  // --- FARMING ---
  {
    id: 1,
    tokenId: 'FARM_TOKEN_ID_1',
    name: 'Yam Harvest Future (Grade A)',
    location: 'Ikorodu Farms, Lagos',
    seller: '0x123...abc',
    price: 50, // Price in HBAR
    image: 'https://via.placeholder.com/150/2DD87F/000000?text=Yams',
    category: 'Produce', // Add category for potential filtering later
  },
  // --- ARTISANS / LOCAL COMMERCE ---
  {
    id: 2,
    tokenId: 'ARTISAN_TOKEN_ID_2',
    name: 'Handwoven Aso Oke Fabric',
    location: 'Local Weaver, Lagos',
    seller: '0xABC...jkl',
    price: 250,
    image: 'https://via.placeholder.com/150/D2691E/FFFFFF?text=Fabric',
    category: 'Crafts',
  },
  // --- INFORMAL GIG ECONOMY (Example Service Token - Conceptual) ---
   {
    id: 3,
    tokenId: 'GIG_TOKEN_ID_3',
    name: 'Plumbing Service (Full Day)',
    location: 'Ikeja Area',
    seller: '0xPLU...mer', // Representing a freelancer
    price: 1000,
    image: 'https://via.placeholder.com/150/1E90FF/FFFFFF?text=Plumbing',
    category: 'Services',
  },
   // --- NGO / PUBLIC GOOD (Example Impact Token - Conceptual) ---
   {
    id: 4,
    tokenId: 'IMPACT_TOKEN_ID_4',
    name: 'Neighborhood Cleanup Task (Verified)',
    location: 'Ajegunle Community',
    seller: 'NGO_Partner_XYZ', // Representing the NGO listing
    price: 50, // Payment per task completion
    image: 'https://via.placeholder.com/150/32CD32/FFFFFF?text=Impact+Gig',
    category: 'Community',
  },
];

// --- The rest of the Marketplace.js component remains the same ---

// The handleBuyClick function
const handleBuyClick = (item) => {
  console.log("Attempting to buy:", item);
  alert(`Initiating purchase for ${item.name} (Token ID: ${item.tokenId}) for ${item.price} HBAR...`);
  // TODO: Logic to call handleBuy (fundEscrow)
};

function Marketplace() {
  return (
    <div className="marketplace-container card">
      <h2>Integro Marketplace</h2>
      {/* Updated description */}
      <p>Tokenized Goods, Services & Impact Opportunities</p>
      <div className="item-list">
        {rwaItems.map((item) => (
          <div key={item.id} className="item-card">
            <img src={item.image} alt={item.name} className="item-image" />
            <h4 className="item-name">{item.name}</h4>
            <p className="item-detail">Category: {item.category}</p> {/* Show category */}
            <p className="item-detail">Location: {item.location}</p>
            {/* Seller info might be less relevant for services/impact */}
            <p className="item-price">{item.price} HBAR</p>
            <button
              onClick={() => handleBuyClick(item)}
              className="hedera-button buy-button"
            >
              {/* Change button text based on category */}
              {item.category === 'Services' || item.category === 'Community' ? 'Fund Gig' : 'Buy Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Marketplace;
