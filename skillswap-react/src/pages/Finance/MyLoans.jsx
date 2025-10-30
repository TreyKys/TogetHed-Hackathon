import React, { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext.jsx';
import BackButton from '../../components/BackButton.jsx';
import { db } from '../../firebase.js';
import './Lending.css';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Hbar } from '@hashgraph/sdk';

const MyLoans = () => {
    const { accountId, callRepayLoan } = useWallet();
    const [loans, setLoans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!accountId) return;

        setIsLoading(true);
        const q = query(collection(db, "loans"), where("borrowerAccountId", "==", accountId));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const loansData = [];
            querySnapshot.forEach((doc) => {
                loansData.push({ id: doc.id, ...doc.data() });
            });
            setLoans(loansData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [accountId]);

    const handleRepay = async (loan) => {
        const repayAmount = Hbar.fromTinybars(loan.principalTinybars).plus(Hbar.fromTinybars(loan.interestTinybars));
        await callRepayLoan(loan.tokenId, repayAmount.toString());
    }

    return (
        <div className="my-loans-container">
            <BackButton />
            <h2>My Loans</h2>
            {isLoading ? (
                <p>Loading your loans...</p>
            ) : loans.length > 0 ? (
                <div className="loans-list">
                    {loans.map(loan => (
                        <div key={loan.id} className="loan-card">
                            <h3>Token ID: {loan.tokenId}</h3>
                            <p>Principal: {Hbar.fromTinybars(loan.principalTinybars).toString()}</p>
                            <p>Interest: {Hbar.fromTinybars(loan.interestTinybars).toString()}</p>
                            <p>Due Date: {new Date(loan.dueTime.seconds * 1000).toLocaleDateString()}</p>
                            <p>Status: {loan.state}</p>
                            {loan.state === 'ACTIVE' && <button onClick={() => handleRepay(loan)}>Repay Loan</button>}
                        </div>
                    ))}
                </div>
            ) : (
                <p>You don't have any loans.</p>
            )}
        </div>
    );
};

export default MyLoans;
