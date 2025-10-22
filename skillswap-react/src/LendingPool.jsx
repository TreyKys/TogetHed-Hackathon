import React from 'react';
import './LendingPool.css';

const LendingPool = () => {
  return (
    <div className="lending-pool-container">
      <h2>Lending Pool</h2>
      <p>Utilize your Real World Assets (RWAs) as collateral to access liquidity.</p>
      <div className="lending-pool-example">
        <img src="https://via.placeholder.com/150" alt="RWA NFT" />
        <div className="rwa-details">
          <h3>Example RWA: Yam Harvest Future</h3>
          <p>Value: 150 HBAR</p>
          <p>Location: Ikorodu, Nigeria</p>
        </div>
      </div>
      <button disabled className="request-loan-button">Request Loan</button>
    </div>
  );
};

export default LendingPool;