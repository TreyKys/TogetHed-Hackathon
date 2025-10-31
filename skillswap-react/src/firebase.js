// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, Timestamp, doc, getDoc, query, where, getDocs, updateDoc, or, limit } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBjS8gfZMynr8kdeodC61b0X37GJevHy_E",
    authDomain: "integro-ecosystem.firebaseapp.com",
    projectId: "integro-ecosystem",
    storageBucket: "integro-ecosystem.firebasestorage.app",
    messagingSenderId: "285529185485",
    appId: "1:285529185485:web:7cfe295b71e13d5b789d84",
    measurementId: "G-42CZ3J0DDN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, onSnapshot, Timestamp, doc, getDoc, query, where, getDocs, updateDoc, or, limit };
