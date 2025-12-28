
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Access environment variables directly to support static analysis by bundlers (Vite/Webpack)
const apiKeyEnv = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_API_KEY) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_API_KEY);

const authDomainEnv = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_AUTH_DOMAIN) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_AUTH_DOMAIN);

const projectIdEnv = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_PROJECT_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID);

const storageBucketEnv = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_STORAGE_BUCKET) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_STORAGE_BUCKET);

const messagingSenderIdEnv = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_MESSAGING_SENDER_ID);

const appIdEnv = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_APP_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_APP_ID);

const measurementIdEnv = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_MEASUREMENT_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_MEASUREMENT_ID);

// Robust fallback configuration
// Using 'memolingo-64931' credentials.
const firebaseConfig = {
  apiKey: apiKeyEnv ? apiKeyEnv : "AIzaSyBjuryCBHZYCHxrnSKwdEERTepzonSXYhs",
  authDomain: authDomainEnv ? authDomainEnv : "memolingo-64931.firebaseapp.com",
  projectId: projectIdEnv ? projectIdEnv : "memolingo-64931",
  storageBucket: storageBucketEnv ? storageBucketEnv : "memolingo-64931.firebasestorage.app",
  messagingSenderId: messagingSenderIdEnv ? messagingSenderIdEnv : "575444578226",
  appId: appIdEnv ? appIdEnv : "1:575444578226:web:c0f743ef5d53d4b80d3eab",
  measurementId: measurementIdEnv ? measurementIdEnv : "G-MEG9VR4GXJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analytics = null;
// Only initialize analytics in browser environment and try/catch to prevent API key errors from crashing the app
if (typeof window !== 'undefined') {
  try {
    // Check if measurementId is actually present before initializing
    if (firebaseConfig.measurementId && firebaseConfig.measurementId !== "G-DEMO") {
        analytics = getAnalytics(app);
    }
  } catch (e) {
    console.warn("Firebase Analytics failed to initialize (this is often safe to ignore during development):", e);
  }
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
