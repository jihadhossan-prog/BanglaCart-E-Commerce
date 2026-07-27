import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration placeholder - fill in with your Firebase Project credentials
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Connectivity validation check
export async function validateFirebaseConnection() {
  if (!firebaseConfig.projectId) {
    console.warn("Firebase config is empty. Application using local state fallback.");
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'settings', 'connection_test'));
    console.log("Connected to Firebase Firestore successfully.");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('client is offline')) {
      console.warn("Firebase client offline or config incomplete.");
    } else {
      console.log("Firebase connection initialized.");
    }
    return false;
  }
}

export default app;
