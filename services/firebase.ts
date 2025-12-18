
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Access environment variables directly to support static analysis by bundlers (Vite/Webpack)
// Dynamic access via variables (e.g. process.env[key]) often fails in production builds because 
// bundlers replace the specific string "process.env.VITE_VAR" with the value.

const apiKey = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_API_KEY) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_API_KEY);

const authDomain = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_AUTH_DOMAIN) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_AUTH_DOMAIN);

const projectId = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_PROJECT_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID);

const storageBucket = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_STORAGE_BUCKET) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_STORAGE_BUCKET);

const messagingSenderId = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_MESSAGING_SENDER_ID);

const appId = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_APP_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_APP_ID);

const measurementId = 
  // @ts-ignore
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) || 
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_MEASUREMENT_ID) ||
  // @ts-ignore
  (typeof process !== 'undefined' && process.env?.FIREBASE_MEASUREMENT_ID);

const isDemo = !apiKey || !projectId;

// Fallback to "demo" values if env vars are missing to prevent crash during development
// This allows the app to load the UI even if Firebase connection fails later
const firebaseConfig = {
  apiKey: apiKey || "demo-key",
  authDomain: authDomain || "demo-project.firebaseapp.com",
  projectId: projectId || "demo-project",
  storageBucket: storageBucket || "demo-project.appspot.com",
  messagingSenderId: messagingSenderId || "1234567890",
  appId: appId || "1:1234567890:web:abcdef123456",
  measurementId: measurementId || "G-DEMO"
};

// Validate config logging only
if (isDemo) {
  console.warn("Firebase Config Warning: API keys missing. Using fallback demo values. Auth and Database features will not work.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Only initialize analytics if we have real keys, otherwise it throws "400 INVALID_ARGUMENT" immediately
// because it tries to register the installation with an invalid API key.
let analytics = null;
if (!isDemo && typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics failed to initialize", e);
  }
}

const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
