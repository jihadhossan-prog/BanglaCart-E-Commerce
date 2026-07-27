// Firebase Configuration & Initialization
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  onSnapshot, 
  serverTimestamp,
  getDocFromServer,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Firebase credentials placeholder - Replace with actual project credentials
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Check if config values are filled
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialize Firebase App safely
let app;
if (!getApps().length) {
  if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
  } else {
    // Provide a dummy app structure for local demo fallback or unconfigured state
    console.warn("AponBazar: Firebase credentials not set yet. Please enter firebaseConfig credentials in firebase-config.js");
  }
} else {
  app = getApp();
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

// Error Handler for Firestore Permission & Network Errors
export function handleFirestoreError(error, operationType, path) {
  const authUser = auth ? auth.currentUser : null;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authUser ? authUser.uid : null,
      email: authUser ? authUser.email : null,
      emailVerified: authUser ? authUser.emailVerified : null,
      isAnonymous: authUser ? authUser.isAnonymous : null
    },
    operationType,
    path
  };
  console.error("Firestore Operation Error:", errInfo);
  return errInfo;
}

// Connection Validation Helper
export async function validateFirestoreConnection() {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, "settings", "connection_test"));
    return true;
  } catch (error) {
    if (error.message && error.message.includes("offline")) {
      console.warn("Firestore client appears offline or misconfigured.");
    }
    return false;
  }
}

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp, increment,
  ref, uploadBytes, getDownloadURL,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile
};
