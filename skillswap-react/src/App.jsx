import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { Client, PrivateKey, TokenAssociateTransaction } from '@hashgraph/sdk';

// Import hardcoded credentials and contract instances from the refactored hedera.js
import {
    signer as hederaSigner,
    assetTokenContract as baseAssetTokenContract,
    escrowContract as baseEscrowContract,
    accountId as hardcodedAccountId,
    rawPrivateKey as hardcodedRawPrivateKey,
    assetTokenId,
    assetTokenContractABI,
    escrowContractAddress,
} from './hedera.js';

function App() {
    // Component State
    const [status, setStatus] = useState("Ready. Click 'Mint RWA NFT' to start.");
    const [isTransactionLoading, setIsTransactionLoading] = useState(false);
    const [flowState, setFlowState] = useState('INITIAL');
    const [tokenId, setTokenId] = useState(null);

    // Hardcoded credentials are used directly, no need for useState for signer/client/accountId
    const signer = hederaSigner;
    const accountId = hardcodedAccountId;
    const rawPrivateKey = hardcodedRawPrivateKey;

    const handleMint = async () => {
        if (!signer || !accountId || !rawPrivateKey) {
            alert("Credentials are not initialized.");
            return;
        }

        setIsTransactionLoading(true);
        setStatus("🚀 Initiating minting process...");

        try {
            // --- 1. Associate Token (Hedera SDK) ---
            setStatus("⏳ 1/3: Associating token with your account...");
            console.log("Step 1: Starting Token Association...");
            console.log(`Using assetTokenId: ${assetTokenId}`); // Add this log

            // Create a Hedera SDK client
            const client = Client.forTestnet();
            const hederaPrivateKey = PrivateKey.fromStringECDSA(rawPrivateKey);
            client.setOperator(accountId, hederaPrivateKey);

            // Create and execute the association transaction
            const assocTx = await new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([assetTokenId])
                .freezeWith(client);

            const signedAssocTx = await assocTx.sign(hederaPrivateKey);
            const assocResponse = await signedAssocTx.execute(client);
            const assocReceipt = await assocResponse.getReceipt(client);

            if (assocReceipt.status.toString() !== 'SUCCESS') {
                throw new Error(`Token association failed with status: ${assocReceipt.status}`);
            }

            console.log("✅ Token Association Successful!");
            setStatus("✅ 1/3: Association successful! Proceeding to mint...");


            // --- 2. Mint NFT (Ethers.js) ---
            setStatus("⏳ 2/3: Minting the NFT via smart contract...");
            console.log("Step 2: Starting NFT Mint...");

            const assetTokenContractWithSigner = baseAssetTokenContract.connect(signer);
            const txResponse = await assetTokenContractWithSigner.safeMint(
                signer.address,
                "Maize Harvest Future",
                "Grade A",
                "Ikorodu, Nigeria", {
                    gasLimit: 1000000
                }
            );

            const receipt = await txResponse.wait();
            console.log("✅ NFT Mint Transaction Successful!");
            console.log("Full Mint Receipt:", JSON.stringify(receipt, null, 2));
            setStatus("✅ 2/3: Mint transaction confirmed!");


            // --- 3. Parse Token ID (Robustly) ---
            setStatus("⏳ 3/3: Parsing transaction receipt for Token ID...");
            console.log("Step 3: Parsing Token ID from receipt logs...");

            let mintedTokenId = null;
            const iface = new ethers.Interface(assetTokenContractABI);

            for (const log of receipt.logs) {
                try {
                    const parsedLog = iface.parseLog(log);
                    if (parsedLog && parsedLog.name === "Transfer") {
                        mintedTokenId = parsedLog.args.tokenId.toString();
                        break; // Exit loop once found
                    }
                } catch (e) {
                    // Ignore logs that don't match the ABI
                }
            }


            if (!mintedTokenId) {
                throw new Error("Could not parse Token ID from the transaction receipt.");
            }

            console.log(`✅ Token ID Found: ${mintedTokenId}`);
            setStatus(`✅ 3/3: Successfully parsed Token ID: ${mintedTokenId}`);


            // --- 4. Update State ---
            setTokenId(mintedTokenId);
            setFlowState("MINTED");
            setStatus(`🎉 Minting Complete! Your Token ID is ${mintedTokenId}.`);

        } catch (error) {
            console.error("Minting failed:", error);
            setStatus(`❌ Minting Failed: ${error.message}`);
            // Log the full error object for more details
            console.error("Full error object:", error);
        } finally {
            setIsTransactionLoading(false);
        }
    };


    const renderUI = () => (
        <div className="card">
            <h3>Golden Path (Debug Mode)</h3>
            <p className="flow-status">Current State: <strong>{flowState}</strong> {tokenId && `(Token ID: ${tokenId})`}</p>

            <div className="button-group">
                <button onClick={handleMint} className="hedera-button" disabled={isTransactionLoading || flowState !== 'INITIAL'}>
                    1. Mint RWA NFT
                </button>
                {/* Placeholder buttons for future steps */}
                <button className="hedera-button" disabled={true}>2. List NFT</button>
                <button className="hedera-button" disabled={true}>3. Buy Now</button>
                <button className="hedera-button" disabled={true}>4. Confirm Delivery</button>
            </div>

            {flowState === 'MINTED' && (
                <div className="success-message">
                    🎉 Congratulations! The minting process was successful.
                </div>
            )}
        </div>
    );

    return (
        <div className="container">
            <div className="header"><h1>Integro Marketplace</h1><p>Debug Client: In-App Minter</p></div>
            <div className="page-container">
                <div className="card">
                    <h3>Connection Status</h3>
                    <div className="status-message status-info">
                        <strong>Account ID:</strong> {accountId}
                    </div>
                     <div className={`status-message ${status.includes('✅') || status.includes('🎉') ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
                        {status}
                    </div>
                </div>

                {renderUI()}

            </div>
        </div>
    );
}

// Styles remain the same
function CustomStyles() {
  return (<style>{`
    .container { max-width: 480px; margin: 20px auto; background: #f9f9f9; border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); overflow: hidden; display: flex; flex-direction: column; font-family: Arial, sans-serif;}
    .header { background: linear-gradient(135deg, #1A1A1A, #000000); color: white; padding: 20px; text-align: center; }
    .header h1 { font-size: 28px; margin: 0; }
    .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .page-container { padding: 20px; }
    .card { background: white; padding: 20px; border-radius: 15px; margin-bottom: 15px;}
    .hedera-button { background: #2DD87F; color: black; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; margin-top: 10px; font-weight: 600; transition: background 0.3s, opacity 0.3s;}
    .hedera-button:hover:not(:disabled) { background: #25b366; }
    .hedera-button:disabled { background: #cccccc; cursor: not-allowed; opacity: 0.6; }
    .status-message { padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center; word-wrap: break-word; }
    .status-info { background: #e3f2fd; color: #1565c0; }
    .status-success { background: #e8f5e8; color: #2e7d32; }
    .status-error { background: #ffebee; color: #c62828; }
    .flow-status { text-align: center; font-size: 14px; color: #333; background-color: #f0f0f0; padding: 8px; border-radius: 8px; margin-bottom: 15px; }
    .button-group button { margin-bottom: 8px; }
    .success-message { text-align: center; padding: 15px; background-color: #e8f5e8; color: #2e7d32; border-radius: 8px; margin-top: 15px; font-weight: bold; }
  `}</style>);
}

function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
