import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Fallback values are used if environment variables are missing (e.g. in local development or preview)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCbHFt-2mkzs24ASj_pDpw8Euo6JJeKCBk",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "fitback-184bd.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "fitback-184bd",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "fitback-184bd.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1067077343589",
  appId: process.env.FIREBASE_APP_ID || "1:1067077343589:web:9c6b7286c308299eaee98c",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-W4YJ6VKQM3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };