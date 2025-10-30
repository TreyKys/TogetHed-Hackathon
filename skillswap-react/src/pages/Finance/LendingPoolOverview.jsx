import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../components/BackButton.jsx';
import './Lending.css';
import { useWallet } from '../../context/WalletContext.jsx';
import { lendingPoolContractAccountId } from '../../hedera.js';
import { ContractCallQuery, Hbar } from '@hashgraph/sdk';
import { Client } from '@hashgraph/sdk';

const LendingPoolOverview = () => {
    const { accountId } = useWallet();
    const [poolData, setPoolData] = useState({
        liquidity: 'Loading...',
        activeLoans: 'Loading...',
        totalValueLocked: 'Loading...',
    });
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const fetchPoolData = async () => {
            try {
                const client = Client.forTestnet();
                const liquidityQuery = new ContractCallQuery()
                    .setContractId(lendingPoolContractAccountId)
                    .setGas(100000)
                    .setFunction("liquidity");

                const liquidityResult = await liquidityQuery.execute(client);
                const liquidity = Hbar.fromTinybars(liquidityResult.getUint256(0));

                const ownerQuery = new ContractCallQuery()
                    .setContractId(lendingPoolContractId)
                    .setGas(100000)
                    .setFunction("owner");

                const ownerResult = await ownerQuery.execute(client);
                const ownerAddress = ownerResult.getAddress(0);

                if (accountId) {
                    setIsAdmin(ownerAddress.toString() === accountId.toString());
                }

                setPoolData({
                    liquidity: `${liquidity.toString()} HBAR`,
                    activeLoans: 'N/A', // This would require more complex logic to get
                    totalValueLocked: 'N/A', // This would require more complex logic to get
                });
            } catch (error) {
                console.error("Failed to fetch pool data:", error);
            }
        };

        fetchPoolData();
    }, [accountId]);

    return (
        <div className="lending-pool-overview-container">
            <BackButton />
            <h2>Lending Pool Overview</h2>
            <div className="pool-stats">
                <div className="stat-card">
                    <h3>Available Liquidity</h3>
                    <p>{poolData.liquidity}</p>
                </div>
                <div className="stat-card">
                    <h3>Active Loans</h3>
                    <p>{poolData.activeLoans}</p>
                </div>
                <div className="stat-card">
                    <h3>Total Value Locked</h3>
                    <p>{poolData.totalValueLocked}</p>
                </div>
            </div>
            <div className="pool-actions">
                <Link to="/take-loan" className="action-button">Take a Loan</Link>
                <Link to="/my-loans" className="action-button">My Loans</Link>
                {isAdmin && <Link to="/deposit-liquidity" className="action-button admin-action">Deposit Liquidity</Link>}
            </div>
        </div>
    );
};

export default LendingPoolOverview;
