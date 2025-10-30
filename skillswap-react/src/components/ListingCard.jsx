import React from 'react';
import { motion } from 'framer-motion';

const ListingCard = ({ listing, handleBuy }) => {
  return (
    <motion.div
      className="listing-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="listing-image">
        {/* Placeholder for image */}
      </div>
      <div className="listing-details">
        <h4>{listing.name}</h4>
        <p>{listing.description}</p>
        <p><strong>Price:</strong> {listing.price} ℏ</p>
        <button onClick={() => handleBuy(listing)} className="hedera-button">Buy Now</button>
      </div>
    </motion.div>
  );
};

export default ListingCard;
