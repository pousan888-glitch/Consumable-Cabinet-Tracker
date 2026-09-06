import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";

// Real Production Firebase Credentials from user
const realFirebaseConfig = {
  apiKey: "AIzaSyAQO0gBpkiASG1NhdUJfQA25R7kUgUzRUQ",
  authDomain: "warehouse-consumables-monitor.firebaseapp.com",
  projectId: "warehouse-consumables-monitor",
  storageBucket: "warehouse-consumables-monitor.firebasestorage.app",
  messagingSenderId: "917732792556",
  appId: "1:917732792556:web:bf74faa9940babf768edc9"
};

// Detect running environment at runtime
const isVercel = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");

// Statically accessible by Vite during build (from Vercel or .env)
const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;

// Optional in-browser runtime config override (allows entering/testing credentials without redeploying)
let browserCustomConfig: typeof realFirebaseConfig | null = null;
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("custom_firebase_config");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.apiKey && parsed?.projectId) {
        browserCustomConfig = parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read custom_firebase_config:", e);
  }
}

const hasValidEnv = !!(envApiKey && envApiKey.trim() !== "" && !envApiKey.includes("MY_") && !envApiKey.includes("YOUR_"));

let activeConfig = realFirebaseConfig;
let configSource: "env" | "custom" | "real_direct" = "real_direct";

if (hasValidEnv) {
  activeConfig = {
    apiKey: envApiKey,
    authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`,
    projectId: envProjectId || "",
    storageBucket: envStorageBucket || `${envProjectId}.firebasestorage.app`,
    messagingSenderId: envMessagingSenderId || "",
    appId: envAppId || ""
  };
  configSource = "env";
} else if (browserCustomConfig) {
  activeConfig = browserCustomConfig;
  configSource = "custom";
} else {
  // Default directly to your real Firebase project!
  activeConfig = realFirebaseConfig;
  configSource = "real_direct";
}

// Real mode active - no forced offline fallback!
const isOfflineFallback = false;
const isRealMode = true;
const isPlaceholderKey = false;

// Safe console diagnostics to help debug configuration at runtime
console.log("[Firebase Real System Active]:", {
  isVercel,
  configSource,
  usingProjectId: activeConfig.projectId,
  usingApiKeyMasked: activeConfig.apiKey ? `${activeConfig.apiKey.substring(0, 6)}...${activeConfig.apiKey.substring(activeConfig.apiKey.length - 4)}` : "None",
  authDomain: activeConfig.authDomain
});

export function getActiveFirebaseConfig() {
  return {
    config: activeConfig,
    source: configSource,
    isVercel,
    isSandbox: activeConfig.projectId === "marklar-horizon-g9pl1"
  };
}

export function saveInAppFirebaseConfig(config: typeof realFirebaseConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem("custom_firebase_config", JSON.stringify(config));
  window.location.reload();
}

export function clearInAppFirebaseConfig() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("custom_firebase_config");
  window.location.reload();
}

// Initialize Firebase
const app = initializeApp(activeConfig);

// Initialize Firestore
// The sandbox database requires a specific database ID: "ai-studio-4091080e-b2cc-4953-bfe1-99ad5bf7c077"
const isSandbox = activeConfig.projectId === "marklar-horizon-g9pl1";
const db = isSandbox 
  ? getFirestore(app, "ai-studio-4091080e-b2cc-4953-bfe1-99ad5bf7c077") 
  : getFirestore(app);

const auth = getAuth(app);

export { 
  app, 
  db, 
  auth,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  writeBatch,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  isOfflineFallback,
  isRealMode,
  isPlaceholderKey,
  isVercel,
  type User
};
