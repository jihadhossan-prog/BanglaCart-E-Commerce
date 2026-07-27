import { db, auth } from './firebase-config.js';
import { collection, addDoc, doc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { formatPrice, showToast, generateOrderNumber } from './core.js';

let cartState = [];

// --- Initialize Cart from LocalStorage & Firestore ---
export function initCart() {
  const saved = localStorage.getItem('banglacart_items');
  if (saved) {
    try { cartState = JSON.parse(saved); } catch (e) { cartState = []; }
  }
  updateCartBadge();
}

function saveCartState() {
  localStorage.setItem('banglacart_items', JSON.stringify(cartState));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const totalCount = cartState.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) {
    if (totalCount > 0) {
      badge.textContent = totalCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// --- Add Product to Cart ---
export function addToCart(product, quantity = 1) {
  const existingIndex = cartState.findIndex(item => item.id === product.id);
  const delCharge = product.deliveryCharge !== undefined ? Number(product.deliveryCharge) : 60;

  if (existingIndex > -1) {
    cartState[existingIndex].quantity += quantity;
  } else {
    cartState.push({
      id: product.id,
      name: product.name,
      price: product.price,
      deliveryCharge: delCharge,
      image: product.images && product.images[0] ? product.images[0] : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
      quantity: quantity
    });
  }
  
  saveCartState();
  showToast('পণ্যটি কার্টে যোগ করা হয়েছে!', 'success');
}

// --- Remove Item ---
export function removeFromCart(productId) {
  cartState = cartState.filter(item => item.id !== productId);
  saveCartState();
  renderCartPage();
}

// --- Update Quantity ---
export function updateCartQuantity(productId, delta) {
  const item = cartState.find(i => i.id === productId);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    saveCartState();
    renderCartPage();
  }
}

// --- Per-Product Delivery Charge & Totals Calculation ---
// Mandatory: Each product has its own Delivery Charge (৳). If cart contains multiple products, system calculates total Delivery Charge based on each product's individual Delivery Charge.
export function calculateCartTotals() {
  const subtotal = cartState.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // Total delivery charge is sum of each item's deliveryCharge * quantity or per distinct product
  const deliveryTotal = cartState.reduce((sum, item) => sum + (item.deliveryCharge * item.quantity), 0);
  const total = subtotal + deliveryTotal;
  
  return { subtotal, deliveryTotal, total };
}

// --- Render Cart View ---
export function renderCartPage() {
  const container = document.getElementById('cart-items-container');
  const summary = document.getElementById('cart-summary-card');
  if (!container || !summary) return;

  if (cartState.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-8 text-center space-y-3 border border-slate-200">
        <p class="text-slate-500 text-sm">আপনার কার্ট খালি আছে</p>
        <a href="#home" class="inline-block btn-primary text-xs py-2 px-4">কেনাকাটা করুন</a>
      </div>
    `;
    summary.classList.add('hidden');
    return;
  }

  summary.classList.remove('hidden');

  container.innerHTML = cartState.map(item => `
    <div class="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
      <img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded-xl bg-slate-100 flex-shrink-0"/>
      <div class="flex-1 min-w-0">
        <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate">${item.name}</h4>
        <p class="text-xs text-emerald-800 font-extrabold mt-0.5">${formatPrice(item.price)}</p>
        <p class="text-[10px] text-slate-500">ডেলিভারি চার্জ: ${item.deliveryCharge === 0 ? 'ফ্রি' : formatPrice(item.deliveryCharge)} /টি</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="window.handleCartQtyChange('${item.id}', -1)" class="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center">-</button>
        <span class="text-xs font-bold w-4 text-center">${item.quantity}</span>
        <button onclick="window.handleCartQtyChange('${item.id}', 1)" class="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center">+</button>
      </div>
      <button onclick="window.handleRemoveCartItem('${item.id}')" class="text-slate-400 hover:text-red-600 p-1">✕</button>
    </div>
  `).join('');

  const { subtotal, deliveryTotal, total } = calculateCartTotals();

  summary.innerHTML = `
    <div class="space-y-2 text-xs text-slate-600">
      <div class="flex justify-between"><span>পণ্যমূল্য (Subtotal):</span><span>${formatPrice(subtotal)}</span></div>
      <div class="flex justify-between"><span>মোট ডেলিভারি চার্জ (পণ্যভিত্তিক):</span><span>${formatPrice(deliveryTotal)}</span></div>
      <div class="border-t border-slate-200 pt-2 flex justify-between font-extrabold text-sm text-slate-900">
        <span>সর্বমোট (Total):</span>
        <span class="text-emerald-800">${formatPrice(total)}</span>
      </div>
    </div>
    <a href="#checkout" class="block w-full btn-primary text-center text-sm py-3 mt-3">চেকআউট করুন</a>
  `;
}

window.handleCartQtyChange = function(pId, delta) {
  updateCartQuantity(pId, delta);
};

window.handleRemoveCartItem = function(pId) {
  removeFromCart(pId);
};

// --- Render Checkout Page Summary ---
export function renderCheckoutPage() {
  const container = document.getElementById('checkout-total-card');
  if (!container) return;

  const { subtotal, deliveryTotal, total } = calculateCartTotals();

  container.innerHTML = `
    <h3 class="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">অর্ডার সামারি</h3>
    <div class="space-y-2 text-xs text-slate-600">
      <div class="flex justify-between"><span>পণ্যের সংখ্যা:</span><span>${cartState.reduce((a,b)=>a+b.quantity,0)} টি</span></div>
      <div class="flex justify-between"><span>সাবটোটাল:</span><span>${formatPrice(subtotal)}</span></div>
      <div class="flex justify-between"><span>পণ্যভিত্তিক ডেলিভারি চার্জ:</span><span>${formatPrice(deliveryTotal)}</span></div>
      <div class="border-t border-slate-200 pt-2 flex justify-between font-black text-sm text-slate-900">
        <span>সর্বমোট দিতে হবে:</span>
        <span class="text-emerald-800 text-base">${formatPrice(total)}</span>
      </div>
    </div>
  `;
}

// --- Submit Order ---
export async function submitOrder(customerInfo, paymentMethod, trxId = '') {
  if (cartState.length === 0) {
    showToast('আপনার কার্ট খালি!', 'error');
    return;
  }

  const { subtotal, deliveryTotal, total } = calculateCartTotals();
  const orderNumber = generateOrderNumber();

  const orderData = {
    orderNumber: orderNumber,
    userId: auth.currentUser?.uid || 'guest',
    customer: customerInfo,
    paymentMethod: paymentMethod,
    transactionId: trxId,
    items: cartState,
    subtotal: subtotal,
    deliveryTotal: deliveryTotal,
    totalAmount: total,
    status: 'pending',
    paymentStatus: paymentMethod === 'COD' ? 'Unpaid' : 'Pending Verification',
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'orders'), orderData);
    
    // Clear Cart
    cartState = [];
    saveCartState();

    // Show Confirmation View
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    const successView = document.getElementById('order-success-view');
    if (successView) {
      document.getElementById('success-order-id').textContent = orderNumber;
      successView.classList.remove('hidden');
    }
    showToast('অর্ডার সফলভাবে দেওয়া হয়েছে!', 'success');
  } catch (error) {
    console.warn("Order submit error:", error);
    showToast('অর্ডার দিতে সমস্যা হয়েছে, পুনরায় চেষ্টা করুন', 'error');
  }
}
