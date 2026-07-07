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

const firebaseConfig = {
  apiKey: "AIzaSyAivsfy9ggmOaegLmxq9cEb7BxsLnt9cQ0",
  authDomain: "marklar-horizon-g9pl1.firebaseapp.com",
  projectId: "marklar-horizon-g9pl1",
  storageBucket: "marklar-horizon-g9pl1.firebasestorage.app",
  messagingSenderId: "442887347911",
  appId: "1:442887347911:web:2c4f9dcda252b64c97e8e2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (using the specific database ID if provided, otherwise default)
// The config specifies: "firestoreDatabaseId": "ai-studio-4091080e-b2cc-4953-bfe1-99ad5bf7c077"
const db = getFirestore(app, "ai-studio-4091080e-b2cc-4953-bfe1-99ad5bf7c077");
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
