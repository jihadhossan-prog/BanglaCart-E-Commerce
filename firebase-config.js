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
    apiKey: "AIzaSyDPT3fRRT8m_zHlpEfo3wuuWe2NRsHHUqs",
    authDomain: "jihad-4b833.firebaseapp.com",
    databaseURL: "https://jihad-4b833-default-rtdb.firebaseio.com",
    projectId: "jihad-4b833",
    storageBucket: "jihad-4b833.firebasestorage.app",
    messagingSenderId: "668587419972",
    appId: "1:668587419972:web:56e7ceb7bfc7a69af7cf11",
    measurementId: "G-ED0VERXNCS"
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
