const handleCreateTestGig = async () => {
  if (!signClient || !accountId) {
    alert("Please connect wallet first.");
    return;
  }

  setIsLoading(true);
  setStatus("🚀 Preparing transaction...");
  
  try {
    // Convert EVM address to Hedera contract ID
    const evmAddress = escrowContractAddress; // "0xaB88Af4647228099fBd2904C25A6feb657beb19a"
    
    // Remove '0x' prefix and convert to Hedera format
    const addressWithoutPrefix = evmAddress.slice(2);
    
    // Create contract ID from EVM address (this is the key fix!)
    const contractId = ContractId.fromEvmAddress(0, 0, addressWithoutPrefix);
    
    const transaction = new ContractExecuteTransaction()
      .setContractId(contractId) // Use the converted contract ID
      .setGas(150000)
      .setFunction("createGig", new ContractFunctionParameters()
        .addAddress(accountId)
        .addUint256(1 * 1e8) // 1 HBAR
      );

    setStatus("📝 Please approve transaction in your wallet...");

    // Get current session
    const session = signClient.session.get(signClient.session.keys[0]);
    
    // Send transaction through WalletConnect
    const result = await signClient.request({
      topic: session.topic,
      chainId: "hedera:testnet",
      request: {
        method: "hedera_signAndExecuteTransaction",
        params: {
          transaction: await transaction.toBytes()
        }
      }
    });

    if (result && result.transactionId) {
      setStatus("✅ Test Gig successfully created on Hedera!");
      alert(`Success! Transaction ID: ${result.transactionId}`);
    } else {
      setStatus("✅ Transaction sent! Check wallet for confirmation.");
      alert("Transaction submitted successfully!");
    }

  } catch (error) {
    console.error("❌ Transaction failed:", error);
    setStatus(`❌ Error: ${error.message}`);
    alert(`Error: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
};