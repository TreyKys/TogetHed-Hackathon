// src/firestoreHelpers.js
import { doc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function saveMintedAssetToFirestore({ tokenId, serialNumber, owner }) {
  const id = `${tokenId}-${serialNumber}`;
  await setDoc(doc(db, "assets", id), {
    tokenId, serialNumber, owner, createdAt: Date.now(), listed: false
  });
}

export async function saveListingToFirestore({ tokenId, serialNumber, seller, priceTinybars, contractTxId }) {
  const id = `${tokenId}-${serialNumber}`;
  await setDoc(doc(db, "listings", id), {
    tokenId, serialNumber, seller, priceTinybars, contractTxId, state: "LISTED", createdAt: Date.now()
  });
}

export async function updateListingStateInFirestore(tokenId, serialNumber, newState) {
  const id = `${tokenId}-${serialNumber}`;
  await updateDoc(doc(db, "listings", id), { state: newState, updatedAt: Date.now() });
}

export async function writeTxToFirestore(obj) {
  await addDoc(collection(db, "transactions"), { ...obj, createdAt: Date.now() });
}

export async function transferAssetOwnerInFirestore(tokenId, serialNumber, newOwner) {
  const assetId = `${tokenId}-${serialNumber}`;
  await updateDoc(doc(db, "assets", assetId), { owner: newOwner, updatedAt: Date.now() });
}