// Firebase Configuration and Initialization
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
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
  increment
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAI_saG53zu7-cG2ZTcOH66-oKYQZ1FRZc",
  authDomain: "gen-lang-client-0746423772.firebaseapp.com",
  projectId: "gen-lang-client-0746423772",
  storageBucket: "gen-lang-client-0746423772.firebasestorage.app",
  messagingSenderId: "772887422846",
  appId: "1:772887422846:web:3216bff1d2521e328cb52f"
};

const DATABASE_ID = "ai-studio-banglamartecomme-93fd2b95-cc80-47a3-942d-1784471f43cf";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, DATABASE_ID);

export { 
  app, 
  auth, 
  db,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
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
  increment
};
