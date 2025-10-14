import { useState, useEffect } from 'react';
import './App.css';
import { HashConnect } from 'hashconnect';
import { ethers } from "ethers";

// --- 1. IMPORT OUR HEDERA CONFIG ---
import { escrowContractAddress, escrowContractABI, getContract } from './hedera';

// --- Reusable UI Components ---
const GigCard = ({ title, description, reward, skills }) => (
    <div className="gig-card">
        <h4>{title}</h4>
        <p>{description}</p>
        <div className="skills">{skills.map(skill => <span key={skill} className="skill-tag">{skill}</span>)}</div>
        <div className="reward">{`Reward: ${reward} HBAR`}</div>
    </div>
);

// --- Main App Pages ---
const Marketplace = ({ onCreateTestGig }) => {
    const [activeTab, setActiveTab] = useState('impact');
    return (
        <div className="marketplace-container">
            <div className="tabs">
                <button onClick={() => setActiveTab('impact')} className={activeTab === 'impact' ? 'active' : ''}>Impact Gigs</button>
                <button onClick={() => setActiveTab('p2p')} className={activeTab === 'p2p' ? 'active' : ''}>Peer-to-Peer</button>
            </div>
            {/* --- ADDED THE TEST BUTTON HERE --- */}
            <button onClick={onCreateTestGig} className="hedera-button" style={{marginBottom: '20px', background: '#007bff', color: 'white'}}>
                <i className="fas fa-vial"></i> Run First On-Chain Test
            </button>
            <div className="gig-list">
                {activeTab === 'impact' ? (
                    <GigCard title="🌱 Build a Crop Traceability dApp" description="Seeking a developer for a farm-to-table tracking system on Hedera for a coffee cooperative." reward="5,000" skills={["Solidity", "Hedera", "React"]} />
                ) : (
                    <GigCard title="🎨 Design a New Company Logo" description="I need a modern and clean logo for my new startup." reward="500" skills={["Design", "Branding"]} />
                )}
                <div className="gig-card placeholder">More gigs coming soon...</div>
            </div>
        </div>
    );
};

const USSDSimulator = () => (
    <div className="ussd-container">
        <div className="phone-screen">
            <div className="ussd-text">
                <p>Welcome to Integro!</p>
                <p>1. List Produce for Sale</p>
                <p>2. Offer a Service</p>
                <p>3. Check My Balance</p>
            </div>
            <div className="ussd-input-area">
                <input type="text" placeholder="Enter option (e.g., 1)" className="ussd-input" />
                <button className="ussd-button">Send</button>
            </div>
        </div>
        <div className="explanation-card">
            <h4>How This Works</h4>
            <p>This simulates how a farmer with a basic phone can list their goods. When they press "Send," our backend mints a Real-World Asset (RWA) NFT on Hedera, making their produce a verifiable digital asset.</p>
        </div>
    </div>
);

const AgentZone = () => (
    <div className="feature-container">
        <h3>Agent Staking Zone</h3>
        <p>Agents are trusted community members who verify real-world assets. To ensure honesty, they must stake HBAR as a security bond.</p>
        <div className="stat-card">
            <h4>Your Stake</h4>
            <div className="stat-value">0 HBAR</div>
        </div>
        <button className="hedera-button">Stake HBAR to Become an Agent</button>
    </div>
);

const LendingPool = () => (
    <div className="feature-container">
        <h3>RWA Lending Pool</h3>
        <p>Once you have earned a tokenized asset (RWA NFT) from listing produce, you can use it as collateral to get an instant micro-loan.</p>
        <div className="stat-card">
            <h4>Available to Borrow</h4>
            <div className="stat-value">10,000 HBAR</div>
        </div>
        <button className="hedera-button" disabled>Request Loan (Requires RWA NFT)</button>
    </div>
);

// --- Main App Component ---
function App() {
    const [accountId, setAccountId] = useState(null);
    const [hashConnect, setHashConnect] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [page, setPage] = useState('market');

    useEffect(() => {
        async function initialize() {
            try {
                const hc = new HashConnect(true);
                const appMetadata = { name: "Integro Marketplace", description: "The Trust Layer for Africa's Operations", icon: "" };

                const hcProvider = hc.getProvider("testnet", hc.hcData.pairingData[0]?.topic, accountId);
                const ethProvider = new ethers.providers.Web3Provider(hcProvider);
                const ethSigner = ethProvider.getSigner();

                setProvider(ethProvider);
                setSigner(ethSigner);

                hc.pairingEvent.on(pairingData => {
                    if (pairingData.accountIds && pairingData.accountIds.length > 0) {
                        setAccountId(pairingData.accountIds[0]);
                    }
                });

                const initData = await hc.init(appMetadata, "testnet", false);
                if (initData.savedPairings.length > 0) {
                    setAccountId(initData.savedPairings[0].accountIds[0]);
                }
                setHashConnect(hc);
            } catch (error) { console.error("Initialization failed:", error); }
        }
        initialize();
    }, []);

    const onConnect = () => hashConnect?.connectToLocalWallet();
    const onDisconnect = async () => {
        if (hashConnect && hashConnect.hcData.pairingData.length > 0) {
            await hashConnect.disconnect(hashConnect.hcData.pairingData[0].topic);
            setAccountId(null);
        }
    };

    const handleCreateTestGig = async () => {
        if (!signer || !accountId) {
            alert("Please connect your wallet first.");
            return;
        }
        try {
            console.log("Getting Escrow contract...");
            const escrowContract = getContract(escrowContractAddress, escrowContractABI, signer);

            const sellerAddress = await signer.getAddress(); // For testing, the buyer is also the seller
            const gigPrice = ethers.utils.parseEther("1.0"); // 1 HBAR

            console.log(`Calling createGig with seller: ${sellerAddress}, price: 1 HBAR`);

            const tx = await escrowContract.createGig(sellerAddress, gigPrice);

            console.log("Transaction sent! Hash:", tx.hash);
            alert("Transaction sent! Waiting for confirmation...");

            await tx.wait(); // Wait for the transaction to be mined

            console.log("✅ Gig created successfully!");
            alert("✅ Test Gig created on the Hedera Testnet!");

        } catch (error) {
            console.error("Failed to create test gig:", error);
            alert(`Error: ${error.message}`);
        }
    };

    const renderPage = () => {
        switch (page) {
            case 'market': return <Marketplace onCreateTestGig={handleCreateTestGig} />;
            case 'ussd': return <USSDSimulator />;
            case 'agent': return <AgentZone />;
            case 'lending': return <LendingPool />;
            default: return <Marketplace onCreateTestGig={handleCreateTestGig} />;
        }
    };

    return (
        <div className="container">
            <div className="header">
                <h1>Integro</h1><p>Powered by Hedera</p>
                <div className="wallet-area">
                    {accountId ? (
                        <div className="connected-state">
                            <span>{accountId ? `${accountId.slice(0, 4)}...${accountId.slice(-4)}` : ''}</span>
                            <button onClick={onDisconnect} className="disconnect-btn">Disconnect</button>
                        </div>
                    ) : (
                        <button onClick={onConnect} className="connect-btn">Connect Wallet</button>
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

// --- CSS Styles ---
function CustomStyles() {
    return (
        <style>{`
            :root { --hedera-green: #2DD87F; --hedera-dark: #1A1A1A; --background: #f0f2f5; }
            body { font-family: 'Poppins', sans-serif; background: var(--background); margin: 0; }
            .container { max-width: 480px; margin: 20px auto; background: #ffffff; border-radius: 20px; box-shadow: 0 8px 32px 0 rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; min-height: 90vh; }
            .header { background: linear-gradient(135deg, #1A1A1A, #000000); color: white; padding: 20px; }
            .header h1 { font-family: 'Comfortaa', cursive; font-size: 28px; margin: 0; text-align: center; }
            .header p { font-size: 12px; opacity: 0.8; margin-top: 4px; text-align: center; }
            .wallet-area { margin-top: 15px; }
            .connect-btn { background: var(--hedera-green); color: black; border: none; padding: 10px 20px; border-radius: 10px; font-size: 14px; cursor: pointer; font-weight: 600; width: 100%; }
            .connected-state { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 10px; }
            .connected-state span { font-size: 14px; font-family: monospace; }
            .disconnect-btn { background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-size: 12px; cursor: pointer; }
            .page-container { flex-grow: 1; padding: 20px; }
            .nav-bar { display: flex; background: #fff; border-top: 1px solid #eee; flex-shrink: 0; }
            .nav-bar button { flex: 1; background: none; border: none; padding: 12px 0; cursor: pointer; color: #6c757d; display: flex; flex-direction: column; align-items: center; gap: 4px; }
            .nav-bar button i { font-size: 20px; }
            .nav-bar button span { font-size: 10px; font-weight: 600; }
            .nav-bar button.active { color: var(--hedera-dark); }
            .tabs { display: flex; border-bottom: 2px solid #eee; margin-bottom: 20px; }
            .tabs button { flex: 1; padding: 15px; background: none; border: none; font-size: 16px; font-weight: 600; cursor: pointer; color: #6c757d; border-bottom: 3px solid transparent; }
            .tabs button.active { color: var(--hedera-dark); border-bottom-color: var(--hedera-green); }
            .gig-list { display: flex; flex-direction: column; gap: 15px; }
            .gig-card { background: white; padding: 20px; border-radius: 15px; border: 1px solid #e0e0e0; }
            .gig-card h4 { margin: 0 0 10px 0; } .gig-card p { margin: 0 0 15px 0; font-size: 14px; line-height: 1.5; }
            .gig-card .reward { font-weight: 600; color: var(--hedera-green); }
            .skills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
            .skill-tag { background: #e8f5e8; color: #2e7d32; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
            .ussd-container { text-align: center; }
            .phone-screen { background: #111; border-radius: 20px; padding: 30px 15px; color: white; font-family: monospace; border: 5px solid #333; }
            .ussd-text p { margin: 5px 0; text-align: left; }
            .ussd-input { width: 100%; background: #333; border: 1px solid #555; border-radius: 5px; color: white; padding: 10px; margin-top: 20px; }
            .ussd-button { width: 100%; background: var(--hedera-green); color: black; border: none; padding: 10px; margin-top: 10px; border-radius: 5px; font-weight: bold; }
            .explanation-card { margin-top: 20px; background: #e3f2fd; padding: 15px; border-radius: 10px; text-align: left; }
            .feature-container { text-align: center; } .feature-container h3 { margin-bottom: 15px; }
            .stat-card { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
            .stat-card h4 { margin: 0 0 10px 0; color: #6c757d; } .stat-value { font-size: 28px; font-weight: 700; color: var(--hedera-dark); }
            .hedera-button { background: var(--hedera-green); color: black; border: none; padding: 14px; border-radius: 12px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 600; }
        `}</style>
    );
}

function MainApp() { return (<><CustomStyles /><App /></>); }
export default MainApp;
