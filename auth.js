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
  getDocs,
  setDoc, 
  updateDoc,
  collection,
  query,
  where
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

export async function loginUser(identifier, password) {
  const input = (identifier || '').trim();
  if (!input) {
    showToast('ইমেইল বা মোবাইল নম্বর দিন', 'error');
    return null;
  }
  if (!password) {
    showToast('পাসওয়ার্ড দিন', 'error');
    return null;
  }

  let emailToUse = input;

  // If user entered a phone number or string without @
  if (!input.includes('@')) {
    try {
      const q = query(collection(db, 'users'), where('phone', '==', input));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        if (userDoc?.email) {
          emailToUse = userDoc.email;
        }
      } else {
        const cleanPhone = input.replace(/^\+88/, '');
        const q2 = query(collection(db, 'users'), where('phone', '==', cleanPhone));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          const userDoc = snap2.docs[0].data();
          if (userDoc?.email) {
            emailToUse = userDoc.email;
          }
        } else {
          showToast('এই মোবাইল নম্বরটি দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি', 'error');
          return null;
        }
      }
    } catch (err) {
      console.warn("Phone lookup error:", err);
    }
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
    showToast('সফলভাবে লগইন করা হয়েছে', 'success');
    return userCredential.user;
  } catch (error) {
    console.warn("Login failed with code:", error?.code || error);
    let msg = 'লগইন করতে ব্যর্থ হয়েছে';
    if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
      msg = 'ইমেইল/মোবাইল বা পাসওয়ার্ড সঠিক নয়';
    } else if (error?.code === 'auth/invalid-email') {
      msg = 'অকার্যকর ইমেইল ঠিকানা';
    } else if (error?.code === 'auth/too-many-requests') {
      msg = 'অনেকবার ভুল চেষ্টা করা হয়েছে, কিছুক্ষণ পর চেষ্টা করুন';
    } else if (error?.code === 'auth/user-disabled') {
      msg = 'আপনার একাউন্টটি স্থগিত করা হয়েছে';
    }
    showToast(msg, 'error');
    return null;
  }
}

let isGoogleLoginPending = false;

export async function loginWithGoogle() {
  if (isGoogleLoginPending) {
    console.warn("Google login already in progress...");
    return null;
  }
  isGoogleLoginPending = true;

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
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
    console.warn("Google login failed with code:", error?.code || error);
    let msg = 'গুগল লগইন করতে ব্যর্থ হয়েছে';
    const code = error?.code || '';
    const message = error?.message || '';

    if (code === 'auth/account-exists-with-different-credential') {
      msg = 'এই ইমেইল দিয়ে আগে থেকেই একটি অ্যাকাউন্ট আছে, দয়া করে Email/Password দিয়ে লগইন করুন';
    } else if (code === 'auth/unauthorized-domain') {
      msg = 'ফায়ারবেস কনসোলে এই ডোমেইনটি (Authorized Domains) অনুমোদিত নয়। দয়াকরে ইমেইল/পাসওয়ার্ড দিয়ে লগইন করুন।';
    } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null;
    } else if (message.includes('INTERNAL ASSERTION FAILED') || code.includes('internal')) {
      console.warn("Suppressed internal Firebase Auth assertion error.");
      msg = 'লগইন প্রক্রিয়ায় কারিগরি সমস্যা হয়েছে, আবার চেষ্টা করুন বা ইমেইল দিয়ে লগইন করুন।';
    }
    showToast(msg, 'error');
    return null;
  } finally {
    isGoogleLoginPending = false;
  }
}

export async function registerUser(email, password, fullName, phone) {
  const cleanEmail = (email || '').trim();
  const cleanPassword = (password || '').trim();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phone || '').trim();

  if (!cleanName) {
    showToast('আপনার নাম লিখুন', 'error');
    return null;
  }
  if (!cleanPhone) {
    showToast('মোবাইল নম্বর লিখুন', 'error');
    return null;
  }
  if (!cleanEmail) {
    showToast('ইমেইল ঠিকানা লিখুন', 'error');
    return null;
  }
  if (cleanPassword.length < 6) {
    showToast('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে', 'error');
    return null;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    const user = userCredential.user;
    
    // Save profile to Firestore with role = customer
    const userData = {
      uid: user.uid,
      email: cleanEmail,
      fullName: cleanName,
      phone: cleanPhone,
      role: 'customer',
      addresses: [],
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', user.uid), userData);
    showToast('একাউন্ট তৈরি সফল হয়েছে', 'success');
    return user;
  } catch (error) {
    console.warn("Registration failed with code:", error?.code || error);
    let msg = 'একাউন্ট তৈরি করতে ব্যর্থ হয়েছে';
    if (error?.code === 'auth/email-already-in-use') {
      msg = 'এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হচ্ছে';
    } else if (error?.code === 'auth/weak-password') {
      msg = 'পাসওয়ার্ডটি অন্তত ৬ অক্ষরের হতে হবে';
    } else if (error?.code === 'auth/invalid-email') {
      msg = 'অকার্যকর ইমেইল ঠিকানা';
    }
    showToast(msg, 'error');
    return null;
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
    if (userProfile) {
      userProfile.defaultAddress = addressData;
    }
    showToast('ঠিকানা হালনাগাদ করা হয়েছে', 'success');
  } catch (error) {
    showToast('ঠিকানা আপডেট করা যায়নি', 'error');
  }
}
