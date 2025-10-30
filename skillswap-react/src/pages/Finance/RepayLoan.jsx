import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext.jsx';
import BackButton from '../../components/BackButton.jsx';
import './Lending.css';

const RepayLoan = () => {
    const { callRepayLoan } = useWallet();
    const [tokenId, setTokenId] = useState('');
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState('');

    const handleRepay = async (e) => {
        e.preventDefault();
        setStatus('Processing...');
        try {
            const receipt = await callRepayLoan(tokenId, amount);
            if (receipt.status.toString() === 'SUCCESS') {
                setStatus('Repayment successful!');
            } else {
                setStatus('Error repaying loan.');
            }
        } catch (error) {
            setStatus('Error repaying loan.');
            console.error(error);
        }
    };

    return (
        <div className="repay-loan-container">
            <BackButton />
            <h2>Repay Loan</h2>
            <form onSubmit={handleRepay}>
                <div className="form-group">
                    <label>Token ID</label>
                    <input
                        type="number"
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Amount (HBAR)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Repay</button>
            </form>
            {status && <p>{status}</p>}
        </div>
    );
};

export default RepayLoan;
