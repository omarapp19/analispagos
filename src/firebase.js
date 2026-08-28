
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Reemplaza estos valores con los de tu consola de Firebase
// Project Settings > General > Your apps > Firebase SDK snippet > Config
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBUlUzkoyHHXndAkneljcwpkAczEwDEhZg",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "analistapagos.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "analistapagos",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "analistapagos.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "286134936419",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:286134936419:web:6421ac2caf175953862956",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-W6CCBTE5ES"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
