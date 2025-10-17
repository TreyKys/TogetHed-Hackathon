import React, { useState, useEffect } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { PrivateKey } from '@hashgraph/sdk'; // For generating new keys
import {
  assetTokenContract,
  escrowContract,
  assetTokenContractAddress,
  getProvider
} from './hedera.js';

function App() {
  const [status, setStatus] = useState("Welcome. Please create your secure vault.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [signer, setSigner] = useState(null);
  const [accountId, setAccountId] = useState(null); // Will hold the user's EVM address
  const [flowState, setFlowState] = useState('MINT');
  const [tokenId, setTokenId] = useState(null);

  // --- 1. Check for an existing wallet on load ---
  useEffect(() => {
    const loadWallet = async () => {
      const storedKey = localStorage.getItem('integro-private-key');
      if (storedKey) {
        setStatus("Restoring your secure vault...");
        const provider = getProvider();
        const loadedSigner = new ethers.Wallet(storedKey, provider);
        const userAddress = await loadedSigner.getAddress();
        
        setSigner(loadedSigner);
        setAccountId(userAddress);
        setStatus(`✅ Vault restored. Welcome back, ${userAddress.slice(0, 6)}...`);
      }
    };
    loadWallet();
  }, []);

  // --- 2. Create a new wallet (The "Vault") ---
  const handleCreateVault = async () => {
    setIsProcessing(true);
    setStatus("Generating your secure keys...");
    try {
      // Generate new keys
      const newPrivateKey = PrivateKey.generateECDSA();
      const newPrivateKeyHex = `0x${newPrivateKey.toStringRaw()}`;
      
      // Save to localStorage (our "Secure Enclave simulation")
      localStorage.setItem('integro-private-key', newPrivateKeyHex);

      // Create the signer
      const provider = getProvider();
      const newSigner = new ethers.Wallet(newPrivateKeyHex, provider);
      const userAddress = await newSigner.getAddress();

      setSigner(newSigner);
      setAccountId(userAddress);
      
      setStatus(`✅ Secure vault created! Address: ${userAddress}`);
    } catch (error) {
      setStatus(`❌ Vault creation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 3. Transaction Logic (Golden Path) ---
  const handleMint = async () => {
    if (!signer) return alert("Vault not ready.");
    setIsProcessing(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      const userAddress = await signer.getAddress();
      const tx = await assetTokenContract.connect(signer).safeMint(userAddress, "Yam Harvest Future", "Grade A", "Ikorodu");
      const receipt = await tx.wait();
      const mintEvent = receipt.logs.find(log => log.eventName === 'Transfer');
      if (!mintEvent) throw new Error("Mint event not found.");
      const mintedTokenId = mintEvent.args[2].toString();
      setTokenId(mintedTokenId);
      setStatus(`✅ NFT Minted! Token ID: ${mintedTokenId}`);
      setFlowState('LIST');
    } catch (error) { setStatus(`❌ Mint failed: ${error.message}`); } finally { setIsProcessing(false); }
  };
  
  const handleList = async () => {
    if (!signer) return alert("Vault not ready.");
    setIsProcessing(true);
    setStatus(" approving and listing NFT...");
    try {
      const approveTx = await assetTokenContract.connect(signer).approve(escrowContract.target, tokenId);
      await approveTx.wait();
      setStatus("✅ Approval successful. Now listing...");
      const priceInHbar = 50;
      const priceInTinybar = ethers.parseUnits(priceInHbar.toString(), 8);
      const listTx = await escrowContract.connect(signer).listAsset(assetTokenContractAddress, tokenId, priceInTinybar);
      await listTx.wait();
      setStatus(`✅ Listed NFT #${tokenId} for ${priceInHbar} HBAR.`);
      setFlowState('BUY');
    } catch (error) { setStatus(`❌ Listing failed: ${error.message}`); } finally { setIsProcessing(false); }
  };

  const handleBuy = async () => {
    if (!signer) return alert("Vault not ready.");
    setIsProcessing(true);
    setStatus("💸 Funding the escrow...");
    try {
      const priceInHbar = 50;
      const priceInWei = ethers.parseEther(priceInHbar.toString());
      const fundTx = await escrowContract.connect(signer).fundEscrow(tokenId, { value: priceInWei });
      await fundTx.wait();
      setStatus(`✅ Escrow for NFT #${tokenId} funded!`);
      setFlowState('CONFIRM');
    } catch (error) { setStatus(`❌ Funding failed: ${error.message}`); } finally { setIsProcessing(false); }
  };

  const handleConfirm = async () => {
    if (!signer) return alert("Vault not ready.");
    setIsProcessing(true);
    setStatus("🤝 Confirming delivery and settling...");
    try {
      const confirmTx = await escrowContract.connect(signer).confirmDelivery(tokenId);
      await confirmTx.wait();
      setStatus(`🎉 Success! Transaction for NFT #${tokenId} is complete.`);
      setFlowState('DONE');
    } catch (error) { setStatus(`❌ Confirmation failed: ${error.message}`); } finally { setIsProcessing(false); }
  };

  // --- 4. The UI ---
  return (
    <div className="container">
      <div className="header"><h1>Integro</h1><p>Powered by Hedera</p></div>
      <div className="page-container">
        <div className="card">
          <h3>Welcome to Integro</h3>
          <div className="status-message status-info"><strong>Status:</strong> {status}</div>
          {!signer && (
            <button onClick={handleCreateVault} disabled={isProcessing} className="hedera-button">
              {isProcessing ? "Creating..." : "Create Your Secure Vault"}
            </button>
          )}
        </div>
        
        {signer && (
          <div className="card">
            <h3>Golden Path User Flow</h3>
            <p>You are now in control of your on-chain identity.</p>
            <button onClick={handleMint} disabled={isProcessing || flowState !== 'MINT'} className="hedera-button">{isProcessing && flowState === 'MINT' ? 'Minting...' : '1. Mint RWA NFT'}</button>
            <button onClick={handleList} disabled={isProcessing || flowState !== 'LIST'} className="hedera-button">{isProcessing && flowState === 'LIST' ? 'Listing...' : '2. List NFT for 50 HBAR'}</button>
            <button onClick={handleBuy} disabled={isProcessing || flowState !== 'BUY'} className="hedera-button">{isProcessing && flowState === 'BUY' ? 'Funding...' : '3. Buy Now (Fund Escrow)'}</button>
            <button onClick={handleConfirm} disabled={isProcessing || flowState !== 'CONFIRM'} className="hedera-button">{isProcessing && flowState === 'CONFIRM' ? 'Confirming...' : '4. Confirm Delivery'}</button>
            {flowState === 'DONE' && (<div className="status-message status-success" style={{marginTop: '15px'}}>✅ Demo Complete!</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomStyles() {
  return (<style>{`.container { max-width: 480px; margin: 20px auto; background: #f9f9f9; border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); overflow: hidden; display: flex; flex-direction: column; font-family: Arial, sans-serif;} .header { background: linear-gradient(135deg, #1A1A1A, #000000); color: white; padding: 20px; text-align: center; } .header h1 { font-size: 28px; margin: 0; } .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; } .page-container { padding: 20px; } .card { background: white; padding: 20px; border-radius: 15px; margin-bottom: 15px;} .hedera-button { background: #2DD87F; color: black; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; margin-top: 15px; font-weight: 600; transition: background 0.3s;} .hedera-button:hover:not(:disabled) { background: #25b366; } .hedera-button:disabled { background: #cccccc; cursor: not-allowed; } .hedera-button.disconnect { background: #ff4444; color: white; } .hedera-button.disconnect:hover { background: #cc3333; } .status-message { padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center; word-break: break-word; } .status-info { background: #e3f2fd; color: #1565c0; } .status-success { background: #e8f5e8; color: #2e7d32; } .status-error { background: #ffebee; color: #c62828; }`}</style>);
}

function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
