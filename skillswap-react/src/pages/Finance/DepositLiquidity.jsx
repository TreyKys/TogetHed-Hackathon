import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext.jsx';
import BackButton from '../../components/BackButton.jsx';
import './Lending.css';

const DepositLiquidity = () => {
    const { depositLiquidityAsAdmin } = useWallet();
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState('');

    const handleDeposit = async (e) => {
        e.preventDefault();
        setStatus('Processing...');
        try {
            const receipt = await depositLiquidityAsAdmin(amount);
            if (receipt.status.toString() === 'SUCCESS') {
                setStatus('Deposit successful!');
            } else {
                setStatus('Error depositing liquidity.');
            }
        } catch (error) {
            setStatus('Error depositing liquidity.');
            console.error(error);
        }
    };

    return (
        <div className="deposit-liquidity-container">
            <BackButton />
            <h2>Deposit Liquidity (Admin)</h2>
            <form onSubmit={handleDeposit}>
                <div className="form-group">
                    <label>Amount (HBAR)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Deposit</button>
            </form>
            {status && <p>{status}</p>}
        </div>
    );
};

export default DepositLiquidity;
