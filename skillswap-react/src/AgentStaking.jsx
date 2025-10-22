import React from 'react';
import './AgentStaking.css';

const AgentStaking = () => {
  return (
    <div className="agent-staking-container">
      <h2>Agent & Rider Staking</h2>
      <p>Stake HBAR to become a verified agent or rider. Staked assets are subject to slashing as a security measure.</p>
      <button disabled className="stake-hbar-button">Stake HBAR</button>
    </div>
  );
};

export default AgentStaking;