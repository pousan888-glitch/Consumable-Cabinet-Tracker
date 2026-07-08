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

// AI Studio Sandbox Credentials
const sandboxConfig = {
  apiKey: "AIzaSyAivsfy9ggmOaegLmxq9cEb7BxsLnt9cQ0",
  authDomain: "marklar-horizon-g9pl1.firebaseapp.com",
  projectId: "marklar-horizon-g9pl1",
  storageBucket: "marklar-horizon-g9pl1.firebasestorage.app",
  messagingSenderId: "442887347911",
  appId: "1:442887347911:web:2c4f9dcda252b64c97e8e2"
};

// Your Custom Firebase Credentials (for Vercel deployment)
const productionConfig = {
  apiKey: "AIzaSyDsEsptCNBdREm-2lZEAfOmLB7ZdMrx168",
  authDomain: "consumable-cabinet-tracker.firebaseapp.com",
  projectId: "consumable-cabinet-tracker",
  storageBucket: "consumable-cabinet-tracker.firebasestorage.app",
  messagingSenderId: "910240387442",
  appId: "1:910240387442:web:b767007ccdee76d7788deb"
};

// Detect running environment at runtime
const isVercel = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
const envApiKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY;

let activeConfig = sandboxConfig;

if (envApiKey) {
  // If you configure environment variables on Vercel manually, use them:
  activeConfig = {
    apiKey: envApiKey,
    authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
  };
} else if (isVercel) {
  // If running on Vercel, automatically default to your new Firebase project!
  activeConfig = productionConfig;
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
  type User
};
