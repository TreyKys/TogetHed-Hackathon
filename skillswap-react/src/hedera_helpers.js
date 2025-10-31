// src/hedera_helpers.js
import { Client, ContractCallQuery, ContractFunctionParameters, Hbar } from "@hashgraph/sdk";
import { AccountId, PrivateKey } from "@hashgraph/sdk";

export async function getOnchainListing(serial, escrowContractId, viewerAccountId, viewerPrivateKey) {
    // viewerAccountId & viewerPrivateKey optional but recommended to construct the client operator
    const client = Client.forTestnet();
    if (viewerAccountId && viewerPrivateKey) {
        const rawPrivKey = viewerPrivateKey.startsWith("0x") ? viewerPrivateKey.slice(2) : viewerPrivateKey;
        client.setOperator(AccountId.fromString(viewerAccountId), PrivateKey.fromStringECDSA(rawPrivKey));
    }
    const q = new ContractCallQuery()
        .setContractId(escrowContractId)
        .setGas(150_000)
        .setFunction("listings", new ContractFunctionParameters().addUint256(serial));
    // use small query payment if operator not set
    if (!viewerAccountId) {
        q.setQueryPayment(Hbar.fromTinybars(1000));
    }
    const res = await q.execute(client);

    // Parse return values:
    // mapping returns (address seller, address buyer, uint256 price, uint8 state)
    // SDK ContractFunctionResult provides getAddress/getUint256/getInt32 etc.
    const seller = res.getAddress(0);
    const buyer = res.getAddress(1);
    const price = res.getUint256(2); // returns BigInt-type or string depending on SDK
    const state = res.getUint8(3); // 0 = LISTED (match your contract)
    return {
        seller,
        buyer,
        price: BigInt(price).toString(), // return string to be safe
        state: Number(state)
    };
}
