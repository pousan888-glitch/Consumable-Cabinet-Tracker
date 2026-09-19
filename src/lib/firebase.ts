import { initializeApp } from "firebase/app";
import { 
  initializeFirestore,
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
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
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

// Initialize Firestore with settings optimized for iOS / WebKit & mobile devices
// CRITICAL FOR IOS: WebKit on iOS indefinitely stalls or pauses HTTP/2 streaming WebChannels.
// Using experimentalForceLongPolling / experimentalAutoDetectLongPolling ensures reliable HTTP communication.
const isSandbox = activeConfig.projectId === "marklar-horizon-g9pl1";
const sandboxDbId = "ai-studio-4091080e-b2cc-4953-bfe1-99ad5bf7c077";

// Detect iOS / iPadOS / WebKit
const isIOS = typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
  (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1)
);

let db: any;
try {
  db = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      // Force long-polling everywhere on mobile / iOS to eliminate WebKit stream hang issues
      experimentalForceLongPolling: true
    },
    isSandbox ? sandboxDbId : undefined
  );
} catch (initErr) {
  console.warn("initializeFirestore fallback to getFirestore:", initErr);
  db = isSandbox ? getFirestore(app, sandboxDbId) : getFirestore(app);
}

const auth = getAuth(app);

// On iOS Safari (especially Private Browsing or WebViews), IndexedDB may throw SecurityError.
// Setting persistence with fallback ensures authentication won't crash on iOS devices.
if (typeof window !== "undefined") {
  try {
    setPersistence(auth, browserLocalPersistence).catch(() => {
      setPersistence(auth, inMemoryPersistence).catch(() => {});
    });
  } catch (e) {
    console.warn("Auth persistence notice:", e);
  }
}

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
