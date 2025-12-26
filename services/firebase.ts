import { FirebaseApp, initializeApp } from "firebase/app";
import { Analytics, getAnalytics } from "firebase/analytics";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

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
const firebaseConfig = {
  apiKey: apiKeyEnv,
  authDomain: authDomainEnv,
  projectId: projectIdEnv,
  storageBucket: storageBucketEnv,
  messagingSenderId: messagingSenderIdEnv,
  appId: appIdEnv,
  measurementId: measurementIdEnv
};

// Basic validation and Safe Init
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | null = null;

if (!firebaseConfig.apiKey) {
  console.error("CRITICAL: Firebase configuration is missing. App may not work correctly.");
  const dummyConfig = { apiKey: "dummy-key-to-prevent-crash", projectId: "dummy" };
  app = initializeApp(dummyConfig);
} else {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase init failed:", e);
    app = initializeApp({ apiKey: "dummy-key-to-prevent-crash" });
  }
}

// Check environment for analytics
if (typeof window !== 'undefined') {
  try {
    if (firebaseConfig.measurementId && firebaseConfig.measurementId !== "G-DEMO") {
      analytics = getAnalytics(app);
    }
  } catch (e) {
    console.warn("Analytics init warning:", e);
  }
}

// Initialize services with error boundary
try {
  auth = getAuth(app);
} catch (e) {
  console.error("Auth init failed:", e);
}

try {
  // Try to initialize with persistence first
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("Firestore persistence init failed, falling back to default:", e);
  try {
    // Fallback to standard Firestore if persistence fails
    db = getFirestore(app);
  } catch (fe) {
    console.error("Critical: Firestore initialization failed completely:", fe);
  }
}

export { app, analytics, auth, db };
