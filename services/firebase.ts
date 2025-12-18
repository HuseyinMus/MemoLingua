
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Helper to get env vars safely across different build environments (Vite, Webpack, etc.)
const getEnv = (key: string) => {
  // Check for Vite's import.meta.env
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  
  // Check for standard process.env (Webpack/Node)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env) {
    // @ts-ignore
    if (process.env[key]) return process.env[key];
    // Fallback: check for the key without VITE_ prefix (e.g. if set in old Vercel envs)
    const legacyKey = key.replace('VITE_', '');
    // @ts-ignore
    if (process.env[legacyKey]) return process.env[legacyKey];
  }

  return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID')
};

// Validate config to prevent crashing with obscure errors
if (!firebaseConfig.projectId) {
  console.error("Firebase Configuration Error: 'projectId' is missing. Please ensure your environment variables are set correctly in .env (starting with VITE_) or your build configuration.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
