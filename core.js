import { db, auth } from './firebase-config.js';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp, addDoc 
} from 'firebase/firestore';

// --- Toast Notification System ---
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Formatters ---
export function formatPrice(amount) {
  const num = Number(amount) || 0;
  return `৳${num.toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(timestamp) {
  if (!timestamp) return 'আজ';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function generateOrderNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'BC-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- Firestore Safe Error Handler ---
export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null
    },
    operationType,
    path
  };
  console.error("Firestore Error:", errInfo);
  showToast(error.message || "ডাটা সিঙ্ক ত্রুটি হয়েছে", 'error');
  return null;
}

// --- Initial Seed Data (Auto-populates Firestore if empty) ---
export const DEFAULT_CATEGORIES = [
  { id: 'cat-gadgets', name: 'গ্যাজেট ও ইলেকট্রনিক্স', icon: 'smartphone', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400' },
  { id: 'cat-fashion', name: 'ফ্যাশন ও পোশাক', icon: 'shirt', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400' },
  { id: 'cat-home', name: 'হোম ও লাইফস্টাইল', icon: 'home', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400' },
  { id: 'cat-groceries', name: 'গ্রোসারি ও ডেইরি', icon: 'shopping-bag', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400' }
];

export const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'ওয়্যারলেস নয়েজ ক্যানসেলিং হেডফোন',
    category: 'cat-gadgets',
    price: 3200,
    originalPrice: 4500,
    deliveryCharge: 60,
    stock: 15,
    rating: 4.8,
    reviewsCount: 34,
    badge: 'সেরা অফার',
    description: 'প্রিমিয়াম কোয়ালিটি সুপার বেস ওয়্যারলেস হেডফোন। ৩০ ঘন্টা ব্যাটারি লাইফ।',
    specifications: 'ব্লুটুথ ৫.৩, ব্যাটারি: ৫০০mAh, চার্জিং: টাইপ-সি',
    brand: 'Anker',
    sku: 'GKN-8821',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-2',
    name: 'স্মার্ট ফিটনেস ট্র্যাকার ওয়াচ',
    category: 'cat-gadgets',
    price: 1850,
    originalPrice: 2600,
    deliveryCharge: 50,
    stock: 22,
    rating: 4.6,
    reviewsCount: 19,
    badge: 'হট প্রোডাক্ট',
    description: 'হৃদস্পন্দন ও অক্সিজেন মনিটরিং সমৃদ্ধ আধুনিক স্মার্টওয়াচ।',
    specifications: 'ডিসপ্লে: ১.৮ ইঞ্চ AMOLED, ওয়াটারপ্রুফ IP68',
    brand: 'Haylou',
    sku: 'SMW-1042',
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-3',
    name: 'প্রিমিয়াম কটন ক্যাজুয়াল শার্ট',
    category: 'cat-fashion',
    price: 1200,
    originalPrice: 1600,
    deliveryCharge: 60,
    stock: 10,
    rating: 4.7,
    reviewsCount: 28,
    badge: 'নতুন কালেকশন',
    description: '১০০% সুতি আরামদায়ক স্লিম ফিট কটন শার্ট।',
    specifications: 'ফ্যাব্রিক: ১০০% সুতি, ধোয়ার নিয়ম: সাধারণ ওয়াশ',
    brand: 'Fabrilife',
    sku: 'FSH-3011',
    images: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-4',
    name: 'লেদার স্লিম ট্রাভেল ওয়ালেট',
    category: 'cat-fashion',
    price: 850,
    originalPrice: 1200,
    deliveryCharge: 40,
    stock: 30,
    rating: 4.9,
    reviewsCount: 42,
    badge: 'ফ্রি ডেলিভারি অফার',
    description: 'জেনুইন কাও লেদার স্মার্ট আরএফআইডি প্রটেক্টেড ওয়ালেট।',
    specifications: 'ম্যাটেরিয়াল: আসল চামড়া, কার্ড স্লট: ৮টি',
    brand: 'Apex',
    sku: 'WLT-9920',
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=600'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-5',
    name: 'অ্যারোমা এসেনশিয়াল অয়েল ডিফিউজার',
    category: 'cat-home',
    price: 1450,
    originalPrice: 2100,
    deliveryCharge: 80,
    stock: 8,
    rating: 4.5,
    reviewsCount: 12,
    badge: 'জনপ্রিয়',
    description: 'ঘরের বাতাস তাজা ও সুবাসিত রাখার জন্য এলইডি লাইট ডিফিউজার।',
    specifications: 'ক্যাপাসিটি: ৫০০ml, টাইমার: ১ঘন্টা/৩ঘন্টা/৬ঘন্টা',
    brand: 'Baseus',
    sku: 'HM-1102',
    images: ['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod-6',
    name: 'অর্গানিক সুন্দরবন খাটি মধু ৫০০ গ্রাম',
    category: 'cat-groceries',
    price: 750,
    originalPrice: 950,
    deliveryCharge: 70,
    stock: 50,
    rating: 5.0,
    reviewsCount: 88,
    badge: '১০০% খাঁটি',
    description: 'সুন্দরবনের প্রাকৃতিক চাক থেকে সংগৃহীত অপরিশোধিত খাঁটি মধু।',
    specifications: 'ওজন: ৫০০ গ্রাম, উৎস: সুন্দরবন',
    brand: 'Khaas Food',
    sku: 'GRO-4001',
    images: ['https://images.unsplash.com/photo-1587049352847-81a56d773cae?w=600'],
    createdAt: new Date().toISOString()
  }
];

export async function checkAndSeedInitialData() {
  try {
    const categoriesSnap = await getDocs(collection(db, 'categories'));
    if (categoriesSnap.empty) {
      console.log("Seeding categories into Firestore...");
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }
    }

    const productsSnap = await getDocs(collection(db, 'products'));
    if (productsSnap.empty) {
      console.log("Seeding products into Firestore...");
      for (const prod of DEFAULT_PRODUCTS) {
        await setDoc(doc(db, 'products', prod.id), prod);
      }
    }

    const bannersSnap = await getDocs(collection(db, 'banners'));
    if (bannersSnap.empty) {
      console.log("Seeding banners into Firestore...");
      await addDoc(collection(db, 'banners'), {
        title: 'সামার মেগা সেল — ৫০% পর্যন্ত ছাড়',
        subtitle: 'সেরা মানের ইলেকট্রনিক্স ও ফ্যাশন পন্যের উপর বিশেষ অফার!',
        image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200',
        buttonText: 'এখনই কেনাকাটা করুন',
        link: '#products'
      });
    }
  } catch (err) {
    console.warn("Auto-seed fallback info:", err);
  }
}
