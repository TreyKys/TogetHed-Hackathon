import { useState, useEffect } from 'react';
import './App.css';
import { ethers } from "ethers";

// Using the CORRECT libraries: WalletConnect SignClient and Modal
import SignClient from "@walletconnect/sign-client";
import { WalletConnectModal } from "@walletconnect/modal";

// Import our Hedera configuration file
import { escrowContractAddress, escrowContractABI, getContract } from './hedera.js';

// --- UI Components ---
const GigCard = ({ title, description, reward, skills }) => ( <div className="gig-card"><h4>{title}</h4><p>{description}</p><div className="skills">{skills.map(skill => <span key={skill} className="skill-tag">{skill}</span>)}</div><div className="reward">{`Reward: ${reward} HBAR`}</div></div> );
const Marketplace = () => { /* ... UI code ... */ };
const USSDSimulator = () => { /* ... UI code ... */ };
const AgentZone = () => { /* ... UI code ... */ };
const LendingPool = () => { /* ... UI code ... */ };

// --- Main App Component ---
function App() {
    const [accountId, setAccountId] = useState(null);
    const [signClient, setSignClient] = useState(null);
    const [modal, setModal] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState('market');
    const [status, setStatus] = useState("Initializing...");
    const [signer, setSigner] = useState(null);

    useEffect(() => {
        async function initialize() {
            try {
                const client = await SignClient.init({
                    projectId: "2798ba475f686a8e0ec83cc2cceb095b",
                    metadata: { name: "Integro Marketplace", description: "A skill marketplace on Hedera", url: window.location.origin, icons: [] },
                });
                const wcModal = new WalletConnectModal({ projectId: "2798ba475f686a8e0ec83cc2cceb095b", chains: ["hedera:testnet"] });
                client.on("session_connect", (event) => {
                    const connectedAccountId = event.params.namespaces.hedera.accounts[0].split(':')[2];
                    setAccountId(connectedAccountId);
                });
                client.on("session_delete", () => { setAccountId(null); setSigner(null); });
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

    useEffect(() => {
        if (signClient && accountId) {
            const newProvider = new ethers.providers.Web3Provider(signClient);
            const newSigner = newProvider.getSigner();
            setSigner(newSigner);
            setStatus("✅ Wallet Connected & Ready!");
        }
    }, [signClient, accountId]);

    const handleConnect = async () => { /* ... (This function remains the same) ... */ };
    const handleDisconnect = async () => { /* ... (This function remains the same) ... */ };

    const handleCreateTestGig = async () => {
        if (!signer) return alert("Signer not ready. Please wait a moment.");
        setStatus("🚀 Sending transaction...");
        try {
            const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);
            const sellerAddress = await signer.getAddress();

            // *** THIS IS THE FIX ***
            // Use the correct modern syntax: ethers.parseUnits
            // Use the correct decimal places for HBAR: 8
            const gigPrice = ethers.parseUnits("1", 8); // Correctly represents 1 HBAR

            const tx = await escrowContract.createGig(sellerAddress, gigPrice);
            setStatus("... Waiting for confirmation ...");
            await tx.wait();
            setStatus("✅ Test Gig successfully created on Hedera!");
            alert("Success! The transaction was confirmed.");
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

    const UpdatedMarketplace = () => (
        <div className="marketplace-container">
            <button onClick={handleCreateTestGig} className="hedera-button" style={{marginBottom: '20px', background: '#007bff', color: 'white'}}>
                <i className="fas fa-vial"></i> Run First On-Chain Test
            </button>
            {/* ... rest of the marketplace UI ... */}
        </div>
    );

    const renderPage = () => {
        switch (page) {
            case 'market': return <UpdatedMarketplace />;
            case 'ussd': return <USSDSimulator />;
            case 'agent': return <AgentZone />;
            case 'lending': return <LendingPool />;
            default: return <UpdatedMarketplace />;
        }
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

function CustomStyles() { /* ... (CSS is the same as the full UI version) ... */ }
function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
