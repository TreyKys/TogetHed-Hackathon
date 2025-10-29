import React from 'react';
import './FlowBadge.css';

const FlowBadge = ({ flowState, nftSerialNumber, price }) => {
    const getBadgeContent = () => {
        switch (flowState) {
            case 'INITIAL':
                return 'State: Vault Created';
            case 'MINTED':
                return `State: NFT Minted (Serial: ${nftSerialNumber})`;
            case 'LISTED':
                return `State: Listed for ${price} HBAR`;
            case 'FUNDED':
                return 'State: Escrow Funded';
            case 'SOLD':
                return 'State: Sale Complete';
            default:
                return `State: ${flowState}`;
        }
    };

    return (
        <div className="flow-badge">
            <p>{getBadgeContent()}</p>
        </div>
    );
};

export default FlowBadge;
