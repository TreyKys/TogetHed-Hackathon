import { useState, useEffect } from 'react';
import './App.css';
import { ethers } from "ethers";

// Using the CORRECT libraries: WalletConnect SignClient and Modal
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";

// Import our Hedera configuration file
import { escrowContractAddress, escrowContractABI, getContract } from './hedera.js';

function App() {
    const [accountId, setAccountId] = useState(null);
    const [signClient, setSignClient] = useState(null);
    const [modal, setModal] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState("Initializing...");

    // This is the "bridge" - the Ethers.js provider and signer
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);

    // This useEffect contains our WORKING WalletConnect initialization logic
    useEffect(() => {
        async function initialize() {
            try {
                const client = await SignClient.init({
                    projectId: "2798ba475f686a8e0ec83cc2cceb095b",
                    metadata: {
                        name: "Integro Marketplace",
                        description: "A skill marketplace on Hedera",
                        url: window.location.origin,
                        icons: [],
                    },
                });

                const wcModal = new WalletConnectModal({
                    projectId: "2798ba475f686a8e0ec83cc2cceb095b",
                    chains: ["hedera:testnet"],
                });

                client.on("session_connect", (event) => {
                    const connectedAccountId = event.params.namespaces.hedera.accounts[0].split(':')[2];
                    setAccountId(connectedAccountId);
                });

                client.on("session_delete", () => {
                    setAccountId(null);
                    setProvider(null); // Clear the bridge on disconnect
                    setSigner(null);
                });

                if (client.session.length > 0) {
                    const lastSession = client.session.get(client.session.keys.at(-1));
                    const existingAccountId = lastSession.namespaces.hedera.accounts[0].split(':')[2];
                    setAccountId(existingAccountId);
                }

                setSignClient(client);
                setModal(wcModal);
            } catch (error) {
                console.error("Initialization failed:", error);
                setStatus("❌ Initialization Failed");
            } finally {
                setIsLoading(false);
            }
        }
        initialize();
    }, []);

    // *** THIS IS THE FIX ***
    // This effect builds the "bridge" AFTER the user connects their wallet
    useEffect(() => {
        if (signClient && accountId) {
            // Use the WalletConnect client as the EIP-1193 provider for Ethers.js
            const newProvider = new ethers.providers.Web3Provider(signClient);
            const newSigner = newProvider.getSigner();
            setProvider(newProvider);
            setSigner(newSigner);
            setStatus("✅ Wallet Connected & Ready for Transactions!");
        }
    }, [signClient, accountId]);

    const handleConnect = async () => {
        if (!signClient || !modal) return;
        setIsLoading(true);
        try {
            const { uri, approval } = await signClient.connect({
                requiredNamespaces: { hedera: { methods: ["hedera_signMessage", "hedera_signAndExecuteTransaction"], chains: ["hedera:testnet"], events: ["chainChanged", "accountsChanged"] } },
            });
            if (uri) {
                await modal.openModal({ uri });
                await approval();
                modal.closeModal();
            }
        } catch (error) {
            console.error("Connection failed:", error); setStatus("❌ Connection Failed");
        } finally { setIsLoading(false); }
    };

    const handleDisconnect = async () => {
        if (signClient && signClient.session.length > 0) {
            const lastSession = signClient.session.get(signClient.session.keys.at(-1));
            await signClient.disconnect({ topic: lastSession.topic, reason: { code: 6000, message: "User disconnected." } });
        }
    };

    // This is the function that calls our smart contract
    const handleCreateTestGig = async () => {
        if (!signer || !accountId) {
            alert("Please connect your wallet first. The signer is not ready.");
            return;
        }
        setStatus("🚀 Sending transaction to Hedera...");
        try {
            const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);

            const sellerAddress = await signer.getAddress();
            const gigPrice = ethers.utils.parseUnits("1", 8); // 1 HBAR (Corrected for Hedera)

            const tx = await escrowContract.createGig(sellerAddress, gigPrice);

            setStatus("... Waiting for transaction confirmation ...");
            await tx.wait(); // Wait for the transaction to be finalized

            setStatus("✅ Test Gig successfully created on the Hedera Testnet!");
            alert("Success! The transaction was confirmed. Check the console for details.");
            console.log("Transaction Receipt:", tx);

        } catch (error) {
            console.error("Failed to create test gig:", error);
            setStatus(`❌ Error: ${error.message}`);
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="container">
            <div className="header">
                <h1>Integro</h1><p>Powered by Hedera</p>
            </div>
            <div className="page-container">
                <div className="card">
                    <h3>Wallet Connection & Test</h3>
                    <div className={`status-message ${accountId ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
                        {status}
                    </div>
                    {accountId ? (
                        <div className="connected-state">
                            <p><strong>Account:</strong> {accountId}</p>
                            <button onClick={handleDisconnect} className="hedera-button disconnect">Disconnect</button>
                        </div>
                    ) : (
                        <button onClick={handleConnect} className="hedera-button" disabled={isLoading}>
                            {isLoading ? "🔄 Initializing..." : "🔗 Connect Wallet"}
                        </button>
                    )}
                </div>
                {accountId && (
                    <div className="card">
                        <h3>On-Chain Test</h3>
                        <p>This will send a real transaction to our Escrow smart contract on the Hedera Testnet.</p>
                        <button onClick={handleCreateTestGig} className="hedera-button">
                            <i className="fas fa-vial"></i> Create Test Gig (1 HBAR)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function CustomStyles() {
    return (
        <style>{`
            :root { --hedera-green: #2DD87F; --hedera-dark: #1A1A1A; --background: #f0f2f5; }
            body { font-family: 'Poppins', sans-serif; background: var(--background); margin: 0; }
            .container { max-width: 480px; margin: 20px auto; background: #ffffff; border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1A1A1A, #000000); color: white; padding: 20px; text-align: center; border-radius: 20px 20px 0 0; }
            .header h1 { font-family: 'Comfortaa', cursive; font-size: 28px; margin: 0; } .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; }
            .page-container { padding: 20px; } .card { background: white; padding: 20px; border-radius: 15px; margin-bottom: 15px; }
            .hedera-button { background: var(--hedera-green); color: black; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 600; }
            .hedera-button:disabled { background: #ccc; cursor: not-allowed; }
            .hedera-button.disconnect { background: #6c757d; color: white; }
            .status-message { padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; }
            .status-info { background: #e3f2fd; color: #1565c0; } .status-success { background: #e8f5e8; color: #2e7d32; } .status-error { background: #ffebee; color: #c62828; }
            .connected-state { text-align: center; } .connected-state p { word-break: break-all; margin-bottom: 15px; }
        `}</style>
    );
}

function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
