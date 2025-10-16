import { useEffect, useState } from "react";
import './App.css';

function App() {
  const [accountId, setAccountId] = useState(null);
  const [status, setStatus] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Simple initialization without WalletConnect for now
    setStatus("Ready to connect");
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    setStatus("Connecting...");
    
    // Simulate connection process
    setTimeout(() => {
      setAccountId("0.0.123456");
      setStatus("✅ Connected successfully!");
      setIsLoading(false);
    }, 2000);
  };

  const handleDisconnect = () => {
    setAccountId(null);
    setStatus("Disconnected");
  };

  const handleCreateTestGig = () => {
    alert("This will create a test gig when WalletConnect is working");
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Integro</h1>
        <p>Powered by Hedera</p>
      </div>

      <div className="page-container">
        <div className="card">
          <h3>Wallet Connection</h3>
          <div className={`status-message ${accountId ? 'status-success' : status.includes('❌') ? 'status-error' : 'status-info'}`}>
            {accountId ? `Connected: ${accountId}` : status}
          </div>
          
          {accountId ? (
            <button onClick={handleDisconnect} className="hedera-button disconnect">
              Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} className="hedera-button" disabled={isLoading}>
              {isLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>

        {accountId && (
          <div className="card">
            <h3>Test Transaction</h3>
            <p>Wallet connection will be added in next step</p>
            <button onClick={handleCreateTestGig} className="hedera-button">
              Create Test Gig (1 HBAR)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Basic CSS styles
function CustomStyles() {
  return (
    <style>{`
      .container { 
        max-width: 480px; 
        margin: 20px auto; 
        background: #f9f9f9; 
        border-radius: 20px; 
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1); 
        overflow: hidden; 
        font-family: Arial, sans-serif;
      }
      .header { 
        background: linear-gradient(135deg, #1A1A1A, #000000); 
        color: white; 
        padding: 20px; 
        text-align: center; 
      }
      .header h1 { 
        font-size: 28px; 
        margin: 0; 
      }
      .header p { 
        font-size: 12px; 
        opacity: 0.8; 
        margin-top: 4px; 
      }
      .page-container { 
        padding: 20px; 
      }
      .card { 
        background: white; 
        padding: 20px; 
        border-radius: 15px; 
        margin-bottom: 15px;
      }
      .hedera-button { 
        background: #2DD87F; 
        color: black; 
        border: none; 
        padding: 14px; 
        border-radius: 12px; 
        font-size: 16px; 
        cursor: pointer; 
        width: 100%; 
        margin-top: 15px; 
        font-weight: 600; 
      }
      .hedera-button:disabled { 
        background: #cccccc; 
        cursor: not-allowed; 
      }
      .hedera-button.disconnect { 
        background: #ff4444; 
        color: white; 
      }
      .status-message { 
        padding: 10px; 
        border-radius: 8px; 
        margin-bottom: 15px; 
        text-align: center; 
      }
      .status-info { 
        background: #e3f2fd; 
        color: #1565c0; 
      }
      .status-success { 
        background: #e8f5e8; 
        color: #2e7d32; 
      }
      .status-error { 
        background: #ffebee; 
        color: #c62828; 
      }
    `}</style>
  );
}

function MainApp() { 
  return (
    <>
      <CustomStyles />
      <App />
    </>
  ); 
}

export default MainApp;