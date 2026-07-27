import { 
  db, 
  collection, 
  addDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from './firebase-config.js';
import { formatPrice, showToast, calculateTotalDeliveryCharge } from './core.js';
import { getCurrentUser } from './auth.js';

let cart = [];
let appliedCoupon = null;

// Initialize Cart from LocalStorage
export function initCart() {
  try {
    const savedCart = localStorage.getItem('banglamart_cart');
    if (savedCart) {
      cart = JSON.parse(savedCart);
    }
  } catch (e) {
    cart = [];
  }
  updateCartBadge();
}

function saveCart() {
  try {
    localStorage.setItem('banglamart_cart', JSON.stringify(cart));
  } catch (e) {
    console.error('Failed to save cart:', e);
  }
  updateCartBadge();
}

export function getCart() {
  return cart;
}

export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) {
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    badge.textContent = totalCount;
    if (totalCount > 0) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  }
}

export function addToCart(product, qty = 1) {
  const existingIndex = cart.findIndex(item => item.id === product.id);
  const currentPrice = product.discountPrice ? Number(product.discountPrice) : Number(product.price);
  const deliveryCharge = Number(product.deliveryCharge) || 0;

  if (existingIndex > -1) {
    cart[existingIndex].qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: currentPrice,
      originalPrice: Number(product.price),
      image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : (product.image || ''),
      deliveryCharge: deliveryCharge,
      sku: product.sku || '',
      qty: qty
    });
  }

  saveCart();
  showToast(`${product.name} কার্টে যোগ করা হয়েছে`, 'success');
}

export function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  showToast('প্রোডাক্ট কার্ট থেকে সরানো হয়েছে', 'info');
}

export function updateCartQuantity(productId, qty) {
  const item = cart.find(i => i.id === productId);
  if (item) {
    if (qty <= 0) {
      removeFromCart(productId);
    } else {
      item.qty = qty;
      saveCart();
    }
  }
}

export function clearCart() {
  cart = [];
  appliedCoupon = null;
  saveCart();
}

export function getSubtotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

export function getTotalDeliveryCharge() {
  // Sum of individual product delivery charges
  return calculateTotalDeliveryCharge(cart);
}

export function getCouponDiscount() {
  if (!appliedCoupon) return 0;
  const subtotal = getSubtotal();
  if (appliedCoupon.type === 'percentage') {
    return Math.round((subtotal * appliedCoupon.value) / 100);
  }
  return Number(appliedCoupon.value) || 0;
}

export function getGrandTotal() {
  const subtotal = getSubtotal();
  const delivery = getTotalDeliveryCharge();
  const discount = getCouponDiscount();
  return Math.max(0, subtotal + delivery - discount);
}

// Validate and Apply Coupon
export async function applyCouponCode(code) {
  if (!code || code.trim() === '') {
    showToast('কুপন কোড লিখুন', 'error');
    return false;
  }

  try {
    const q = query(collection(db, 'coupons'), where('code', '==', code.trim().toUpperCase()));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      showToast('অকার্যকর কুপন কোড', 'error');
      return false;
    }

    let couponData = null;
    snap.forEach(docSnap => couponData = docSnap.data());

    // Check expiry
    if (couponData.expiryDate) {
      const exp = new Date(couponData.expiryDate).getTime();
      if (Date.now() > exp) {
        showToast('কুপনটির মেয়াদ শেষ হয়ে গেছে', 'error');
        return false;
      }
    }

    // Check min spend
    const subtotal = getSubtotal();
    if (couponData.minSpend && subtotal < Number(couponData.minSpend)) {
      showToast(`এই কুপনের জন্য সর্বনিম্ন ${formatPrice(couponData.minSpend)} কেনাকাটা প্রয়োজন`, 'error');
      return false;
    }

    appliedCoupon = couponData;
    showToast('কুপন সফলভাবে প্রয়োগ করা হয়েছে!', 'success');
    return true;
  } catch (err) {
    console.error('Apply coupon error:', err);
    showToast('কুপন যাচাই ব্যর্থ হয়েছে', 'error');
    return false;
  }
}

// Create Order in Firestore
export async function placeOrder(orderData) {
  const user = getCurrentUser();
  if (cart.length === 0) {
    showToast('আপনার কার্ট খালি!', 'error');
    return null;
  }

  try {
    const orderNumber = 'BM-' + Math.floor(100000 + Math.random() * 900000);
    const subtotal = getSubtotal();
    const deliveryTotal = getTotalDeliveryCharge();
    const discount = getCouponDiscount();
    const grandTotal = getGrandTotal();

    const fullOrderDoc = {
      orderNumber,
      userId: user ? user.uid : 'guest',
      customerInfo: {
        fullName: orderData.fullName,
        phone: orderData.phone,
        division: orderData.division,
        district: orderData.district,
        upazila: orderData.upazila,
        area: orderData.area,
        address: orderData.address,
        note: orderData.note || ''
      },
      paymentMethod: orderData.paymentMethod, // COD, bkash, nagad
      paymentStatus: orderData.paymentMethod === 'COD' ? 'Unpaid' : 'Pending Verification',
      trxId: orderData.trxId || '',
      orderStatus: 'Processing',
      items: cart,
      subtotal,
      deliveryChargeTotal: deliveryTotal,
      couponDiscount: discount,
      grandTotal,
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'orders'), fullOrderDoc);
    clearCart();
    return { id: docRef.id, ...fullOrderDoc };
  } catch (err) {
    console.error('Error placing order:', err);
    showToast('অর্ডার সম্পন্ন করতে সমস্যা হয়েছে', 'error');
    return null;
  }
}
