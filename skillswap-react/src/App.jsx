import React, { useEffect, useState } from 'react';
import './App.css';
import { ethers } from 'ethers';
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";
import { 
  assetTokenContract, 
  escrowContract,
  assetTokenContractAddress
} from "./hedera.js"; // Make sure your hedera.js exports the contract instances (without a signer)

// WalletConnect Project ID
const projectId = "2798ba475f686a8e0ec83cc2cceb095b";

// We need to create a provider instance here to be used by the signer
const hederaProvider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");

function App() {
  const [status, setStatus] = useState("Initializing...");
  const [accountId, setAccountId] = useState(null);
  const [signer, setSigner] = useState(null);
  const [signClient, setSignClient] = useState(null);
  const [modal, setModal] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flowState, setFlowState] = useState('MINT');
  const [tokenId, setTokenId] = useState(null);

  // This effect runs ONLY ONCE to initialize the wallet client
  useEffect(() => {
    const initialize = async () => {
      try {
        const client = await SignClient.init({
          projectId: projectId,
          metadata: { name: "Integro Marketplace", description: "A skill marketplace on Hedera", url: window.location.origin, icons: [] },
        });
        const wcModal = new WalletConnectModal({ projectId: projectId, chains: ["hedera:testnet"] });
        
        client.on("session_connect", (event) => onSessionConnect(event.params));
        
        if (client.session.length > 0) {
          const lastSession = client.session.get(client.session.keys.at(-1));
          onSessionConnect(lastSession);
        }
        
        setSignClient(client);
        setModal(wcModal);
        setStatus("Ready to connect wallet.");
      } catch (error) {
        console.error("Initialization failed:", error);
        setStatus(`❌ Init error: ${error.message}`);
      }
    };
    initialize();
  }, []);

  // This function is called ONLY after a session is connected
  const onSessionConnect = (session) => {
    try {
      const fullAccountId = session.namespaces.hedera.accounts[0];
      const hederaAccountId = fullAccountId.split(':')[2];
      const evmAddress = session.namespaces.hedera.accounts[0].split(':')[2]; // Using the account ID as the EVM address for WalletConnect on Hedera

      setAccountId(hederaAccountId);
      
      // We create a signer that is connected to the user's wallet address
      const walletConnectSigner = hederaProvider.getSigner(evmAddress);
      setSigner(walletConnectSigner);
      
      setStatus(`✅ Connected as: ${hederaAccountId}`);
    } catch (error) {
      console.error("Failed to set up signer:", error);
      setStatus(`❌ Connection error: ${error.message}`);
    }
  };

  const handleConnect = async () => {
    if (!signClient || !modal) return;
    setIsProcessing(true);
    setStatus("🔄 Requesting connection...");
    try {
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: { hedera: { methods: ["hedera_signAndExecuteTransaction"], chains: ["hedera:testnet"], events: [] } },
      });
      if (uri) {
        await modal.openModal({ uri });
        await approval();
        modal.closeModal();
      }
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus("❌ Connection rejected.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- FULL GOLDEN PATH TRANSACTION LOGIC ---
  const handleMint = async () => {
    if (!signer) return alert("Wallet not connected properly.");
    setIsProcessing(true);
    setStatus("🚀 Minting RWA NFT...");
    try {
      const userAddress = await signer.getAddress();
      const tx = await assetTokenContract.connect(signer).safeMint(userAddress, "Yam Harvest Future", "Grade A", "Ikorodu");
      const receipt = await tx.wait();
      const mintEvent = receipt.logs.find(log => log.eventName === 'Transfer');
      const mintedTokenId = mintEvent.args[2].toString();
      setTokenId(mintedTokenId);
      setStatus(`✅ NFT Minted! Token ID: ${mintedTokenId}`);
      setFlowState('LIST');
    } catch (error) {
      console.error("Minting failed:", error);
      setStatus(`❌ Mint failed: ${error.message}`);
    } finally { setIsProcessing(false); }
  };

  const handleList = async () => {
    if (!signer) return alert("Wallet not connected properly.");
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
    } catch (error) {
      console.error("Listing failed:", error);
      setStatus(`❌ Listing failed: ${error.message}`);
    } finally { setIsProcessing(false); }
  };

  const handleBuy = async () => {
    if (!signer) return alert("Wallet not connected properly.");
    setIsProcessing(true);
    setStatus("💸 Funding the escrow...");
    try {
      const priceInHbar = 50;
      const priceInWei = ethers.parseEther(priceInHbar.toString());
      const fundTx = await escrowContract.connect(signer).fundEscrow(tokenId, { value: priceInWei });
      await fundTx.wait();
      setStatus(`✅ Escrow for NFT #${tokenId} funded!`);
      setFlowState('CONFIRM');
    } catch (error) {
      console.error("Funding failed:", error);
      setStatus(`❌ Funding failed: ${error.message}`);
    } finally { setIsProcessing(false); }
  };

  const handleConfirm = async () => {
    if (!signer) return alert("Wallet not connected properly.");
    setIsProcessing(true);
    setStatus("🤝 Confirming delivery and settling...");
    try {
      const confirmTx = await escrowContract.connect(signer).confirmDelivery(tokenId);
      await confirmTx.wait();
      setStatus(`🎉 Success! Transaction for NFT #${tokenId} is complete.`);
      setFlowState('DONE');
    } catch (error) {
      console.error("Confirmation failed:", error);
      setStatus(`❌ Confirmation failed: ${error.message}`);
    } finally { setIsProcessing(false); }
  };

  // --- UI ---
  return (
    <div className="container">
      <div className="header"><h1>Integro</h1><p>Powered by Hedera</p></div>
      <div className="page-container">
        <div className="card">
          <h3>Connection Status</h3>
          <div className="status-message">{status}</div>
          {!accountId ? (
            <button onClick={handleConnect} disabled={isProcessing} className="hedera-button">
              {isProcessing ? "🔄 Initializing..." : "🔗 Connect Wallet"}
            </button>
          ) : null}
        </div>
        
        {accountId && signer && (
          <div className="card">
            <h3>Golden Path User Flow</h3>
            <p>Click the buttons in order to test the full transaction lifecycle.</p>
            
            <button onClick={handleMint} disabled={isProcessing || flowState !== 'MINT'} className="hedera-button">
              {isProcessing && flowState === 'MINT' ? 'Minting...' : '1. Mint RWA NFT'}
            </button>
            
            <button onClick={handleList} disabled={isProcessing || flowState !== 'LIST'} className="hedera-button">
              {isProcessing && flowState === 'LIST' ? 'Listing...' : '2. List NFT for 50 HBAR'}
            </button>

            <button onClick={handleBuy} disabled={isProcessing || flowState !== 'BUY'} className="hedera-button">
              {isProcessing && flowState === 'BUY' ? 'Funding...' : '3. Buy Now (Fund Escrow)'}
            </button>

            <button onClick={handleConfirm} disabled={isProcessing || flowState !== 'CONFIRM'} className="hedera-button">
              {isProcessing && flowState === 'CONFIRM' ? 'Confirming...' : '4. Confirm Delivery'}
            </button>

            {flowState === 'DONE' && (
              <div className="status-message status-success" style={{marginTop: '15px'}}>
                ✅ Demo Complete! Verify on HashScan.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Keep your existing CustomStyles and MainApp components
function CustomStyles() {
  return (<style>{`.container { max-width: 480px; margin: 20px auto; background: #f9f9f9; border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); overflow: hidden; display: flex; flex-direction: column; font-family: Arial, sans-serif;} .header { background: linear-gradient(135deg, #1A1A1A, #000000); color: white; padding: 20px; text-align: center; } .header h1 { font-size: 28px; margin: 0; } .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; } .page-container { padding: 20px; } .card { background: white; padding: 20px; border-radius: 15px; margin-bottom: 15px;} .hedera-button { background: #2DD87F; color: black; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; margin-top: 15px; font-weight: 600; transition: background 0.3s;} .hedera-button:hover:not(:disabled) { background: #25b366; } .hedera-button:disabled { background: #cccccc; cursor: not-allowed; } .hedera-button.disconnect { background: #ff4444; color: white; } .hedera-button.disconnect:hover { background: #cc3333; } .status-message { padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center; word-break: break-word; } .status-info { background: #e3f2fd; color: #1565c0; } .status-success { background: #e8f5e8; color: #2e7d32; } .status-error { background: #ffebee; color: #c62828; }`}</style>);
}

function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
