
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Reemplaza estos valores con los de tu consola de Firebase
// Project Settings > General > Your apps > Firebase SDK snippet > Config
const firebaseConfig = {
    apiKey: "AIzaSyBUlUzkoyHHXndAkneljcwpkAczEwDEhZg",
    authDomain: "analistapagos.firebaseapp.com",
    projectId: "analistapagos",
    storageBucket: "analistapagos.firebasestorage.app",
    messagingSenderId: "286134936419",
    appId: "1:286134936419:web:6421ac2caf175953862956",
    measurementId: "G-W6CCBTE5ES"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
