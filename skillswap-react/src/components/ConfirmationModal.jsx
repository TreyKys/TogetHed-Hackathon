import React from 'react';
import './ConfirmationModal.css';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, priceInHbar, priceInTinybars }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Confirm Purchase</h2>
                <p>Are you sure you want to buy this RWA?</p>
                <div className="price-details">
                    <p>Price: <strong>{priceInHbar} HBAR</strong></p>
                    <p>({priceInTinybars} tinybars)</p>
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="cancel-btn">Cancel</button>
                    <button onClick={onConfirm} className="confirm-btn">Confirm</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
