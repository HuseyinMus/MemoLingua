import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCbHFt-2mkzs24ASj_pDpw8Euo6JJeKCBk",
  authDomain: "fitback-184bd.firebaseapp.com",
  projectId: "fitback-184bd",
  storageBucket: "fitback-184bd.firebasestorage.app",
  messagingSenderId: "1067077343589",
  appId: "1:1067077343589:web:9c6b7286c308299eaee98c",
  measurementId: "G-W4YJ6VKQM3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };