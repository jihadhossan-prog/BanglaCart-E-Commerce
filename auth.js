// User Authentication & Role Management Module
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  handleFirestoreError
} from "./firebase-config.js";
import { showToast } from "./core.js";

export let currentUser = null;
export let currentUserProfile = null;

// Register New Customer
export async function registerCustomer({ fullName, email, password, phone }) {
  if (!auth || !db) {
    showToast("Firebase configured required for registration", "error");
    throw new Error("Firebase not initialized");
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userProfile = {
      uid: user.uid,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: "customer", // Default mandatory role
      avatarUrl: "",
      division: "",
      district: "",
      upazila: "",
      area: "",
      address: "",
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, "users", user.uid), userProfile);
    currentUserProfile = userProfile;
    showToast("Account created successfully!");
    return userProfile;
  } catch (error) {
    handleFirestoreError(error, "write", "users");
    showToast(error.message || "Registration failed", "error");
    throw error;
  }
}

// Login Customer or Admin
export async function loginUser(email, password) {
  if (!auth || !db) {
    showToast("Firebase config required", "error");
    throw new Error("Firebase not initialized");
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Fetch user profile & role
    const profileDoc = await getDoc(doc(db, "users", user.uid));
    let profile = null;

    if (profileDoc.exists()) {
      profile = profileDoc.data();
    } else {
      // Fallback profile creation if absent
      profile = {
        uid: user.uid,
        fullName: user.displayName || email.split("@")[0],
        email: user.email,
        phone: "",
        role: email.toLowerCase() === "jihadhossan10000@gmail.com" ? "admin" : "customer",
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "users", user.uid), profile);
    }

    currentUserProfile = profile;
    showToast(`Welcome back, ${profile.fullName}!`);
    return profile;
  } catch (error) {
    showToast(error.message || "Login failed. Check credentials.", "error");
    throw error;
  }
}

// Reset Password
export async function sendPasswordReset(email) {
  if (!auth) return;
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Password reset link sent to your email.");
  } catch (error) {
    showToast(error.message || "Failed to send reset link", "error");
  }
}

// Logout
export async function logoutUser() {
  if (!auth) return;
  try {
    await signOut(auth);
    currentUser = null;
    currentUserProfile = null;
    showToast("Logged out successfully");
    window.location.reload();
  } catch (error) {
    showToast("Logout failed", "error");
  }
}

// Subscribe to Auth State Changes
export function initAuthObserver(onProfileLoaded) {
  if (!auth) {
    if (onProfileLoaded) onProfileLoaded(null);
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          currentUserProfile = userDoc.data();
        } else {
          currentUserProfile = {
            uid: user.uid,
            email: user.email,
            role: "customer"
          };
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    } else {
      currentUserProfile = null;
    }

    if (onProfileLoaded) {
      onProfileLoaded(currentUserProfile);
    }
  });
}

// Update Personal Address & Information
export async function updateUserAddress(addressData) {
  if (!currentUser || !db) return;
  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      fullName: addressData.fullName || "",
      phone: addressData.phone || "",
      division: addressData.division || "",
      district: addressData.district || "",
      upazila: addressData.upazila || "",
      area: addressData.area || "",
      address: addressData.address || ""
    });
    
    currentUserProfile = { ...currentUserProfile, ...addressData };
    showToast("Profile address updated!");
  } catch (err) {
    showToast("Failed to update profile", "error");
  }
}
