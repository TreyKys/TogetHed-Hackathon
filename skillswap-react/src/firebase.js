// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// These should be set in your environment variables (e.g., in a .env file)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "dummy-key",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "dummy-domain",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "dummy-bucket",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "dummy-app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);