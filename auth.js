import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { showToast } from './core.js';

let currentUserData = null;

// --- Get Current Auth User & User Profile Document ---
export function getCurrentUserData() {
  return currentUserData;
}

export function getCurrentUser() {
  return auth.currentUser;
}

// --- Listen to Auth Changes ---
export function initAuthListener(onUserChanged) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          currentUserData = { uid: user.uid, ...userDocSnap.data() };
        } else {
          // Create new user profile document
          const newUserData = {
            uid: user.uid,
            name: user.displayName || user.email?.split('@')[0] || 'গ্রাহক',
            email: user.email || '',
            phone: user.phoneNumber || '',
            role: 'customer',
            photoURL: user.photoURL || '',
            createdAt: new Date().toISOString()
          };
          await setDoc(userDocRef, newUserData);
          currentUserData = newUserData;
        }
      } catch (e) {
        console.warn("Auth doc fetch info:", e);
        currentUserData = {
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'গ্রাহক',
          email: user.email || '',
          role: 'customer'
        };
      }
    } else {
      currentUserData = null;
    }
    
    if (typeof onUserChanged === 'function') {
      onUserChanged(currentUserData);
    }
  });
}

// --- Register with Email & Password ---
export async function registerUser(email, password, name, phone = '') {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: name });
    
    const userDocData = {
      uid: user.uid,
      name: name,
      email: email,
      phone: phone,
      role: 'customer',
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', user.uid), userDocData);
    currentUserData = userDocData;
    showToast('সফলভাবে রেজিস্ট্রেশন সম্পন্ন হয়েছে!', 'success');
    return userDocData;
  } catch (error) {
    showToast(error.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে', 'error');
    throw error;
  }
}

// --- Login with Email & Password ---
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    showToast('সফলভাবে লগইন হয়েছে!', 'success');
    return userCredential.user;
  } catch (error) {
    showToast('ইমেইল অথবা পাসওয়ার্ড সঠিক নয়', 'error');
    throw error;
  }
}

// --- Login with Google ---
export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    showToast('গুগল লগইন সফল হয়েছে!', 'success');
    return result.user;
  } catch (error) {
    showToast('গুগল লগইন ব্যর্থ হয়েছে', 'error');
    throw error;
  }
}

// --- Forgot Password ---
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে', 'success');
  } catch (error) {
    showToast('পাসওয়ার্ড রিসেট লিংক পাঠাতে ব্যর্থ হয়েছে', 'error');
  }
}

// --- Logout ---
export async function logoutUser() {
  try {
    await signOut(auth);
    currentUserData = null;
    showToast('লগআউট করা হয়েছে', 'info');
  } catch (error) {
    showToast('লগআউট ব্যর্থ হয়েছে', 'error');
  }
}
