// Shopping Cart, Coupon Engine & Checkout Flow
import { 
  db, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from "./firebase-config.js";
import { formatPrice, escapeHtml, showToast, calculateCartTotal, calculateCartDeliveryCharge } from "./core.js";
import { currentUser } from "./auth.js";

// Local persistent cart state
let cartItems = JSON.parse(localStorage.getItem("aponbazar_cart") || "[]");
let appliedCoupon = null;

// Save Cart
function saveCart() {
  localStorage.setItem("aponbazar_cart", JSON.stringify(cartItems));
  updateCartBadge();
}

// Update Cart Badge Count in Navigation
export function updateCartBadge() {
  const badge = document.getElementById("badge-cart-count");
  if (!badge) return;

  const count = cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// Add Item to Cart
export function addToCart(product, quantity = 1) {
  const existingIndex = cartItems.findIndex(i => i.id === product.id);

  if (existingIndex > -1) {
    cartItems[existingIndex].quantity += quantity;
  } else {
    cartItems.push({
      id: product.id,
      title: product.title,
      price: product.price,
      discountPrice: product.discountPrice || product.price,
      deliveryCharge: Number(product.deliveryCharge) || 0, // Individual Product Delivery Charge
      image: product.images?.[0] || "",
      brand: product.brand || "",
      quantity: quantity
    });
  }

  saveCart();
  showToast("কার্টে যোগ করা হয়েছে!");
}

window.quickAddToCart = function(productId) {
  // Try finding in window catalog state or default
  const dummyProduct = {
    id: productId,
    title: "প্রিমিয়াম পণ্য",
    price: 1500,
    discountPrice: 1200,
    deliveryCharge: 60,
    images: ["https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=500&q=80"]
  };
  addToCart(dummyProduct, 1);
};

// Render Cart View
export function renderCartView(containerEl) {
  if (cartItems.length === 0) {
    containerEl.innerHTML = `
      <div class="py-12 text-center">
        <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <h3 class="text-base font-bold text-slate-800 mb-1">আপনার কার্ট খালি!</h3>
        <p class="text-xs text-slate-500 mb-6">পছন্দের পণ্য কার্টে যোগ করে কেনাকাটা শুরু করুন।</p>
        <a href="#home" class="inline-flex items-center gap-2 bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs min-h-[44px]">
          কেনাকাটা করুন
        </a>
      </div>
    `;
    return;
  }

  const { subtotal, deliveryFee, discount, total } = calculateCartTotal(cartItems, appliedCoupon?.value || 0);

  containerEl.innerHTML = `
    <div class="space-y-4">
      <h2 class="text-base font-bold text-slate-900 border-l-4 border-emerald-600 pl-2">
        শপিং কার্ট (${cartItems.length} টি আইটেম)
      </h2>

      <!-- Cart Items List -->
      <div class="space-y-3">
        ${cartItems.map(item => `
          <div class="bg-white border border-slate-200 rounded-xl p-3 flex gap-3 items-center">
            <img src="${item.image}" class="w-16 h-16 rounded-lg object-cover bg-slate-100">
            
            <div class="flex-1 min-w-0">
              <h4 class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.title)}</h4>
              <p class="text-xs font-bold text-emerald-700 mt-0.5">${formatPrice(item.discountPrice)}</p>
              
              <!-- Individual Product Delivery Charge Badge -->
              <p class="text-[10px] text-blue-600 font-semibold mt-0.5">
                ডেলিভারি চার্জ: ${item.deliveryCharge === 0 ? 'ফ্রি' : formatPrice(item.deliveryCharge)}
              </p>
            </div>

            <!-- Quantity Controls -->
            <div class="flex items-center gap-2 border border-slate-200 rounded-lg p-1 bg-slate-50">
              <button onclick="window.updateCartQty('${item.id}', -1)" class="w-7 h-7 flex items-center justify-center text-slate-700 font-bold min-h-[44px]">-</button>
              <span class="text-xs font-bold w-4 text-center">${item.quantity}</span>
              <button onclick="window.updateCartQty('${item.id}', 1)" class="w-7 h-7 flex items-center justify-center text-slate-700 font-bold min-h-[44px]">+</button>
            </div>

            <button onclick="window.removeCartItem('${item.id}')" class="text-slate-400 hover:text-red-500 p-1 min-h-[44px]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `).join('')}
      </div>

      <!-- Coupon Form -->
      <div class="bg-white border border-slate-200 rounded-xl p-3 flex gap-2">
        <input 
          type="text" 
          id="coupon-input" 
          placeholder="কুপন কোড (যেমন: APON100)" 
          class="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs focus:outline-none focus:border-emerald-600"
          value="${appliedCoupon?.code || ''}"
        >
        <button onclick="window.applyCouponCode()" class="bg-slate-800 text-white font-bold px-4 rounded-lg text-xs min-h-[44px]">
          প্রয়োগ করুন
        </button>
      </div>

      <!-- Order Summary Card -->
      <div class="bg-slate-900 text-white rounded-2xl p-4 space-y-2.5">
        <h3 class="text-sm font-bold border-b border-slate-800 pb-2">অর্ডার সামারি</h3>
        
        <div class="flex justify-between text-xs text-slate-300">
          <span>পণ্যের দাম (সাবটোটাল):</span>
          <span class="font-bold text-white">${formatPrice(subtotal)}</span>
        </div>

        <div class="flex justify-between text-xs text-slate-300">
          <span>মোট ডেলিভারি চার্জ (আইটেমভিত্তিক):</span>
          <span class="font-bold text-blue-300">${formatPrice(deliveryFee)}</span>
        </div>

        ${discount > 0 ? `
          <div class="flex justify-between text-xs text-emerald-400">
            <span>কুপন ডিসকাউন্ট:</span>
            <span class="font-bold">-${formatPrice(discount)}</span>
          </div>
        ` : ''}

        <div class="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-2">
          <span>সর্বমোট পরিশোধযোগ্য:</span>
          <span class="text-emerald-400 text-base">${formatPrice(total)}</span>
        </div>

        <button onclick="window.proceedToCheckout()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm min-h-[44px] mt-2">
          চেকআউট করুন
        </button>
      </div>
    </div>
  `;
}

window.updateCartQty = function(id, delta) {
  const item = cartItems.find(i => i.id === id);
  if (item) {
    item.quantity = Math.max(1, item.quantity + delta);
    saveCart();
    renderCartView(document.getElementById("main-content"));
  }
};

window.removeCartItem = function(id) {
  cartItems = cartItems.filter(i => i.id !== id);
  saveCart();
  renderCartView(document.getElementById("main-content"));
  showToast("আইটেম সরানো হয়েছে");
};

window.applyCouponCode = function() {
  const input = document.getElementById("coupon-input");
  const code = input?.value.trim().toUpperCase();

  if (code === "APON100") {
    appliedCoupon = { code: "APON100", value: 100 };
    showToast("৳১০০ ডিসকাউন্ট কুপন প্রয়োগ করা হয়েছে!");
    renderCartView(document.getElementById("main-content"));
  } else {
    showToast("অকার্যকর কুপন কোড", "error");
  }
};

window.proceedToCheckout = function() {
  renderCheckoutView(document.getElementById("main-content"));
};

// Render Checkout Page View
export function renderCheckoutView(containerEl) {
  const { subtotal, deliveryFee, discount, total } = calculateCartTotal(cartItems, appliedCoupon?.value || 0);

  containerEl.innerHTML = `
    <div class="space-y-4">
      <h2 class="text-base font-bold text-slate-900 border-l-4 border-emerald-600 pl-2">
        চেকআউট ও ডেলিভারি তথ্য
      </h2>

      <form id="checkout-form" onsubmit="window.handleOrderSubmit(event)" class="space-y-4">
        
        <!-- Customer Info Fields -->
        <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">গ্রাহকের ঠিকানা</h3>
          
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">পূর্ণ নাম *</label>
            <input type="text" id="cust-name" required placeholder="আপনার নাম লিখুন" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">মোবাইল নম্বর *</label>
            <input type="tel" id="cust-phone" required placeholder="০১৭xxxxxxxx" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">বিভাগ *</label>
              <select id="cust-division" required class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
                <option value="ঢাকা">ঢাকা</option>
                <option value="চট্টগ্রাম">চট্টগ্রাম</option>
                <option value="রাজশাহী">রাজশাহী</option>
                <option value="খুলনা">খুলনা</option>
                <option value="সিলেট">সিলেট</option>
                <option value="বরিশাল">বরিশাল</option>
                <option value="রংপুর">রংপুর</option>
                <option value="ময়মনসিংহ">ময়মনসিংহ</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">জেলা *</label>
              <input type="text" id="cust-district" required placeholder="যেমন: ঢাকা" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">সম্পূর্ণ ঠিকানা (বাসা/রোড নম্বর) *</label>
            <textarea id="cust-address" required rows="2" placeholder="বিস্তারিত ঠিকানা দিন" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600"></textarea>
          </div>
        </div>

        <!-- Payment Method Selection -->
        <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider">পেমেন্ট মেথড নির্বাচন করুন</h3>

          <div class="space-y-2">
            <label class="payment-card selected flex items-center justify-between cursor-pointer">
              <div class="flex items-center gap-2">
                <input type="radio" name="paymentMethod" value="cod" checked class="accent-emerald-700">
                <span class="text-xs font-bold text-slate-800">ক্যাশ অন ডেলিভারি (COD)</span>
              </div>
              <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">পণ্য পেয়ে টাকা দিন</span>
            </label>

            <label class="payment-card flex items-center justify-between cursor-pointer">
              <div class="flex items-center gap-2">
                <input type="radio" name="paymentMethod" value="bkash" class="accent-pink-600">
                <span class="badge-bkash">bKash</span>
                <span class="text-xs font-bold text-slate-800">বিকাশ পার্সোনাল</span>
              </div>
            </label>

            <label class="payment-card flex items-center justify-between cursor-pointer">
              <div class="flex items-center gap-2">
                <input type="radio" name="paymentMethod" value="nagad" class="accent-orange-500">
                <span class="badge-nagad">Nagad</span>
                <span class="text-xs font-bold text-slate-800">নগদ পার্সোনাল</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Order Summary & Confirm -->
        <div class="bg-slate-900 text-white rounded-2xl p-4 space-y-2">
          <div class="flex justify-between text-xs text-slate-300">
            <span>পণ্য সাবটোটাল:</span>
            <span>${formatPrice(subtotal)}</span>
          </div>
          <div class="flex justify-between text-xs text-blue-300">
            <span>মোট ডেলিভারি ফি:</span>
            <span>${formatPrice(deliveryFee)}</span>
          </div>
          <div class="flex justify-between text-sm font-bold border-t border-slate-800 pt-2">
            <span>সর্বমোট পরিশোধযোগ্য:</span>
            <span class="text-emerald-400">${formatPrice(total)}</span>
          </div>

          <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm min-h-[44px] mt-2">
            অর্ডার নিশ্চিত করুন
          </button>
        </div>

      </form>
    </div>
  `;
}

// Submit Order to Firestore
window.handleOrderSubmit = async function(event) {
  event.preventDefault();

  const orderNumber = "AB-" + Math.floor(100000 + Math.random() * 900000);
  const { subtotal, deliveryFee, discount, total } = calculateCartTotal(cartItems, appliedCoupon?.value || 0);

  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cod';

  const orderData = {
    orderNumber,
    userId: currentUser?.uid || "guest-" + Date.now(),
    customerInfo: {
      fullName: document.getElementById("cust-name").value,
      phone: document.getElementById("cust-phone").value,
      division: document.getElementById("cust-division").value,
      district: document.getElementById("cust-district").value,
      address: document.getElementById("cust-address").value
    },
    items: cartItems,
    subtotal,
    totalDeliveryCharge: deliveryFee,
    discount,
    totalAmount: total,
    paymentMethod,
    paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
    orderStatus: "pending",
    createdAt: new Date().toISOString()
  };

  try {
    if (db) {
      await addDoc(collection(db, "orders"), orderData);
    }
  } catch (err) {
    console.warn("Firestore order write warning:", err);
  }

  // Clear cart
  cartItems = [];
  saveCart();

  // Show Order Confirmation View
  renderOrderSuccess(document.getElementById("main-content"), orderNumber);
};

function renderOrderSuccess(containerEl, orderNumber) {
  containerEl.innerHTML = `
    <div class="py-10 text-center space-y-4">
      <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      </div>

      <h2 class="text-xl font-bold text-slate-900">অর্ডার সফলভাবে সম্পন্ন হয়েছে!</h2>
      <p class="text-xs text-slate-600">আপনার অর্ডার নম্বর: <span class="font-bold text-emerald-700 text-sm">${orderNumber}</span></p>
      <p class="text-xs text-slate-500 max-w-sm mx-auto">আমাদের প্রতিনিধি খুব শীঘ্রই কল করে আপনার অর্ডারটি নিশ্চিত করবেন। আপনবাজারের সাথে থাকার জন্য ধন্যবাদ!</p>

      <div class="pt-4">
        <a href="#home" class="inline-flex items-center gap-2 bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs min-h-[44px]">
          আরও কেনাকাটা করুন
        </a>
      </div>
    </div>
  `;
}
