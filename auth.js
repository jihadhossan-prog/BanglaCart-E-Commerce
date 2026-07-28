import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from './firebase-config.js';
import { showToast } from './core.js';

let currentUser = null;
let userProfile = null;
const authStateListeners = [];

export function onAuthChange(callback) {
  authStateListeners.push(callback);
  if (currentUser !== undefined) {
    callback(currentUser, userProfile);
  }
}

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    try {
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        userProfile = { uid: user.uid, ...docSnap.data() };
      } else {
        // Create user document if missing
        userProfile = {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName || 'Customer',
          phone: '',
          role: 'customer',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, userProfile);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      userProfile = { uid: user.uid, email: user.email, role: 'customer' };
    }
  } else {
    userProfile = null;
  }

  authStateListeners.forEach(cb => cb(currentUser, userProfile));
});

export function getCurrentUser() {
  return currentUser;
}

export function getUserProfile() {
  return userProfile;
}

export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    showToast('সফলভাবে লগইন করা হয়েছে', 'success');
    return userCredential.user;
  } catch (error) {
    console.error("Login error:", error);
    let msg = 'লগইন করতে ব্যর্থ হয়েছে';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      msg = 'ইমেইল বা পাসওয়ার্ড সঠিক নয়';
    }
    showToast(msg, 'error');
    throw error;
  }
}

export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      const userData = {
        uid: user.uid,
        email: user.email || '',
        fullName: user.displayName || 'গ্রাহক',
        phone: '',
        role: 'customer',
        addresses: [],
        createdAt: new Date().toISOString()
      };
      await setDoc(userRef, userData);
    }

    showToast('গুগল দিয়ে সফলভাবে লগইন করা হয়েছে', 'success');
    return user;
  } catch (error) {
    console.error("Google login error:", error);
    let msg = 'গুগল লগইন করতে ব্যর্থ হয়েছে';
    if (error.code === 'auth/account-exists-with-different-credential') {
      msg = 'এই ইমেইল দিয়ে আগে থেকেই একটি অ্যাকাউন্ট আছে, দয়া করে Email/Password দিয়ে লগইন করুন';
    } else if (error.code === 'auth/popup-closed-by-user') {
      return;
    }
    showToast(msg, 'error');
    throw error;
  }
}

export async function registerUser(email, password, fullName, phone) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save profile to Firestore with role = customer
    const userData = {
      uid: user.uid,
      email: email.trim(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      role: 'customer', // Always customer on registration
      addresses: [],
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', user.uid), userData);
    showToast('একাউন্ট তৈরি সফল হয়েছে', 'success');
    return user;
  } catch (error) {
    console.error("Registration error:", error);
    let msg = 'একাউন্ট তৈরি করতে ব্যর্থ হয়েছে';
    if (error.code === 'auth/email-already-in-use') {
      msg = 'এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হচ্ছে';
    } else if (error.code === 'auth/weak-password') {
      msg = 'পাসওয়ার্ডটি অন্তত ৬ অক্ষরের হতে হবে';
    }
    showToast(msg, 'error');
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    showToast('লগআউট সফল হয়েছে', 'info');
  } catch (error) {
    showToast('লগআউট করা সম্ভব হয়নি', 'error');
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('পাসওয়ার্ড রিসেট লিঙ্ক ইমেইলে পাঠানো হয়েছে', 'success');
  } catch (error) {
    showToast('ইমেইল পাঠানো সম্ভব হয়নি', 'error');
    throw error;
  }
}

export async function updateUserAddress(addressData) {
  if (!currentUser) return;
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      defaultAddress: addressData
    });
    userProfile.defaultAddress = addressData;
    showToast('ঠিকানা হালনাগাদ করা হয়েছে', 'success');
  } catch (error) {
    showToast('ঠিকানা আপডেট করা যায়নি', 'error');
  }
}
