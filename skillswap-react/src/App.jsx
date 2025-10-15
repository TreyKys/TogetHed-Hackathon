import { useState, useEffect } from 'react';
import './App.css';

// 1. Import the CORRECT libraries
import { Transaction, ContractExecuteTransaction, ContractFunctionParameters, ContractId } from "@hashgraph/sdk";
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";

// Import our Hedera configuration file
import { escrowContractAddress } from './hedera.js';

function App() {
    const [accountId, setAccountId] = useState(null);
    const [signClient, setSignClient] =useState(null);
    const [modal, setModal] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState("Initializing...");
    const [page, setPage] = useState('market');

    // This useEffect contains our WORKING WalletConnect initialization logic
    useEffect(() => {
        async function initialize() {
            try {
                const client = await SignClient.init({
                    projectId: "2798ba475f686a8e0ec83cc2cceb095b",
                    metadata: { name: "Integro Marketplace", url: window.location.origin, icons: [] },
                });
                const wcModal = new WalletConnectModal({ projectId: "2798ba475f686a8e0ec83cc2cceb095b", chains: ["hedera:testnet"] });

                client.on("session_connect", (event) => {
                    const connectedAccountId = event.params.namespaces.hedera.accounts[0].split(':')[2];
                    setAccountId(connectedAccountId);
                    setStatus("✅ Wallet Connected & Ready!");
                });
                client.on("session_delete", () => { setAccountId(null); });

                if (client.session.length > 0) {
                    const lastSession = client.session.get(client.session.keys.at(-1));
                    const existingAccountId = lastSession.namespaces.hedera.accounts[0].split(':')[2];
                    setAccountId(existingAccountId);
                }
                setSignClient(client);
                setModal(wcModal);
            } catch (error) { console.error("Initialization failed:", error); setStatus("❌ Initialization Failed");
            } finally { setIsLoading(false); }
        }
        initialize();
    }, []);

    const handleConnect = async () => { /* This function remains the same */ };
    const handleDisconnect = async () => { /* This function remains the same */ };

    // *** THIS IS THE FINAL FIX ***
    // This function is now rewritten to use the native Hedera SDK (@hashgraph/sdk)
    const handleCreateTestGig = async () => {
        if (!signClient || !accountId) return alert("Please connect your wallet first.");
        setStatus("🚀 Preparing transaction...");

        try {
            const lastSession = signClient.session.get(signClient.session.keys.at(-1));

            // 2. Build the transaction using the Hedera SDK
            const transaction = new ContractExecuteTransaction()
                .setContractId(ContractId.fromSolidityAddress(escrowContractAddress)) // CORRECT WAY to parse address
                .setGas(100000) // Set a gas limit
                .setFunction("createGig", new ContractFunctionParameters()
                    .addAddress(accountId) // For testing, the buyer is also the seller
                    .addUint256(1 * 1e8) // Price: 1 HBAR (1 * 10^8 tinybar)
                );

            setStatus("... Please approve the transaction in your wallet ...");

            // 3. Send the transaction to the wallet for signing and execution
            const result = await signClient.request({
                topic: lastSession.topic,
                chainId: "hedera:testnet",
                request: {
                    method: "hedera_signAndExecuteTransaction",
                    params: [transaction.toBytes()],
                },
            });

            setStatus("✅ Test Gig successfully created on Hedera!");
            alert(`Success! Transaction ID: ${result.transactionId}`);
            console.log("Transaction Result:", result);

        } catch (error) {
            console.error("Failed to create test gig:", error);
            setStatus(`❌ Error: ${error.message}`);
            alert(`Error: ${error.message}`);
        }
    };

    // Re-add the handleConnect and handleDisconnect functions here
    async function reAddHandleConnect() {
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
    }
    async function reAddHandleDisconnect() {
        if (signClient && signClient.session.length > 0) {
            const lastSession = signClient.session.get(signClient.session.keys.at(-1));
            await signClient.disconnect({ topic: lastSession.topic, reason: { code: 6000, message: "User disconnected." } });
        }
    }

    // --- Full UI Skeletons ---
    const Marketplace = () => { /* ... UI code ... */ };
    const USSDSimulator = () => { /* ... UI code ... */ };
    const AgentZone = () => { /* ... UI code ... */ };
    const LendingPool = () => { /* ... UI code ... */ };

    const renderPage = () => {
        // Add the test button directly to the marketplace for now
        if (page === 'market') return (
            <div>
                <div className="card">
                    <h3>On-Chain Test</h3>
                    <p>This will send a real transaction to our Escrow smart contract.</p>
                    <button onClick={handleCreateTestGig} className="hedera-button">
                        <i className="fas fa-vial"></i> Create Test Gig
                    </button>
                </div>
                <Marketplace />
            </div>
        );
        // ... other cases ...
    };

    return (
        <div className="container">
            <div className="header">
                 <h1>Integro</h1><p>Powered by Hedera</p>
                <div className="wallet-area">
                    {accountId ? (
                        <div className="connected-state">
                            <span>{`${accountId.slice(0, 4)}...${accountId.slice(-4)}`}</span>
                            <button onClick={reAddHandleDisconnect} className="disconnect-btn">Disconnect</button>
                        </div>
                    ) : (
                        <button onClick={reAddHandleConnect} className="connect-btn" disabled={isLoading}>
                            {isLoading ? "🔄 Initializing..." : "🔗 Connect Wallet"}
                        </button>
                    )}
                </div>
            </div>
             <div className="page-container">{renderPage()}</div>
             <div className="nav-bar">
                <button onClick={() => setPage('market')} className={page === 'market' ? 'active' : ''}><i className="fas fa-store"></i><span>Market</span></button>
                <button onClick={() => setPage('ussd')} className={page === 'ussd' ? 'active' : ''}><i className="fas fa-mobile-alt"></i><span>USSD</span></button>
                <button onClick={() => setPage('agent')} className={page === 'agent' ? 'active' : ''}><i className="fas fa-user-shield"></i><span>Agent</span></button>
                <button onClick={() => setPage('lending')} className={page === 'lending' ? 'active' : ''}><i className="fas fa-hand-holding-usd"></i><span>Lending</span></button>
            </div>
        </div>
    );
}

// All other components and styles remain the same
function CustomStyles() { /* ... same as before ... */ }
function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
