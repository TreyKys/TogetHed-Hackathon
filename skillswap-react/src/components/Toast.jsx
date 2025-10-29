import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, txHash, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000); // Auto-close after 5 seconds

        return () => {
            clearTimeout(timer);
        };
    }, [onClose]);

    return (
        <div className="toast-notification">
            <p>{message}</p>
            {txHash && (
                <a
                    href={`https://hashscan.io/testnet/transaction/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View on Hashscan
                </a>
            )}
            <button onClick={onClose} className="close-toast">&times;</button>
        </div>
    );
};

export default Toast;
