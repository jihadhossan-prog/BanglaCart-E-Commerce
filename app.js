// Customer App Main Controller & Hash Router
import { initAuthObserver, currentUser, currentUserProfile, loginUser, registerCustomer, logoutUser, updateUserAddress } from "./auth.js";
import { renderHomeCategorySections } from "./shop.js";
import { renderCartView, renderCheckoutView, updateCartBadge } from "./cart-checkout.js";
import { renderChatView } from "./chat.js";
import { showToast, escapeHtml, formatPrice, initPWA } from "./core.js";
import { db, collection, query, where, getDocs, doc, getDoc } from "./firebase-config.js";

// Global Wishlist Memory State
let wishlistSet = new Set(JSON.parse(localStorage.getItem("aponbazar_wishlist") || "[]"));

export function isInWishlist(productId) {
  return wishlistSet.has(productId);
}

export function toggleWishlist(productId) {
  if (wishlistSet.has(productId)) {
    wishlistSet.delete(productId);
    showToast("উইশলিস্ট থেকে সরানো হয়েছে");
  } else {
    wishlistSet.add(productId);
    showToast("উইশলিস্টে যোগ করা হয়েছে!");
  }
  localStorage.setItem("aponbazar_wishlist", JSON.stringify(Array.from(wishlistSet)));
}

window.toggleWishlistClick = function(productId) {
  toggleWishlist(productId);
  handleHashRoute();
};

// Application Router
function handleHashRoute() {
  const hash = window.location.hash || "#home";
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;

  // Highlight Bottom Nav
  document.querySelectorAll(".bottom-nav-item").forEach(el => el.classList.remove("active"));

  if (hash === "#home" || hash === "" || hash.startsWith("#category-")) {
    document.getElementById("nav-home")?.classList.add("active");
    renderHomeCategorySections(mainContent);
  } else if (hash === "#wishlist") {
    document.getElementById("nav-wishlist")?.classList.add("active");
    renderWishlistView(mainContent);
  } else if (hash === "#cart") {
    document.getElementById("nav-cart")?.classList.add("active");
    renderCartView(mainContent);
  } else if (hash === "#chat") {
    document.getElementById("nav-chat")?.classList.add("active");
    renderChatView(mainContent);
  } else if (hash === "#profile" || hash === "#register") {
    if (hash === "#register") authMode = "register";
    document.getElementById("nav-profile")?.classList.add("active");
    renderProfileView(mainContent);
  } else if (hash === "#orders") {
    renderOrdersView(mainContent);
  } else if (hash === "#help") {
    renderHelpView(mainContent);
  } else if (hash === "#contact") {
    renderContactView(mainContent);
  } else if (hash === "#about") {
    renderAboutView(mainContent);
  } else {
    renderHomeCategorySections(mainContent);
  }

  // Close drawer if open
  closeDrawer();
}

// Drawer Controls
function setupDrawerEvents() {
  const btnOpen = document.getElementById("btn-open-drawer");
  const btnClose = document.getElementById("btn-close-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const drawer = document.getElementById("side-drawer");

  btnOpen?.addEventListener("click", () => {
    drawer?.classList.add("active");
    backdrop?.classList.add("active");
  });

  const closeFn = () => {
    drawer?.classList.remove("active");
    backdrop?.classList.remove("active");
  };

  btnClose?.addEventListener("click", closeFn);
  backdrop?.addEventListener("click", closeFn);

  document.getElementById("btn-drawer-logout")?.addEventListener("click", () => {
    logoutUser();
    closeFn();
  });
}

function closeDrawer() {
  document.getElementById("side-drawer")?.classList.remove("active");
  document.getElementById("drawer-backdrop")?.classList.remove("active");
}

// Render Wishlist View
function renderWishlistView(containerEl) {
  const items = Array.from(wishlistSet);

  if (items.length === 0) {
    containerEl.innerHTML = `
      <div class="py-12 text-center">
        <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
        </div>
        <h3 class="text-sm font-bold text-slate-800 mb-1">উইশলিস্ট খালি!</h3>
        <p class="text-xs text-slate-500 mb-4">পছন্দের পণ্যটি সংরক্ষণ করতে হার্ট আইকনে ট্যাপ করুন।</p>
      </div>
    `;
    return;
  }

  containerEl.innerHTML = `
    <div class="space-y-3">
      <h2 class="text-base font-bold text-slate-900 border-l-4 border-emerald-600 pl-2">
        আমার উইশলিস্ট (${items.length})
      </h2>
      <div class="grid grid-cols-2 gap-3">
        ${items.map(id => `
          <div class="bg-white border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center">
            <p class="text-xs font-bold text-slate-800 mb-2">আইটেম #${id}</p>
            <button onclick="window.quickAddToCart('${id}')" class="w-full bg-emerald-700 text-white font-bold py-1.5 text-xs rounded-lg min-h-[44px]">
              কার্টে যোগ করুন
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Render Profile & Auth Forms View
let authMode = "login"; // "login" or "register"

window.toggleAuthMode = function(mode) {
  authMode = mode;
  const mainContent = document.getElementById("main-content");
  if (mainContent && (window.location.hash === "#profile" || window.location.hash === "#register")) {
    renderProfileView(mainContent);
  }
};

function renderProfileView(containerEl) {
  if (!currentUser) {
    if (authMode === "register") {
      containerEl.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 max-w-md mx-auto">
          <div class="text-center">
            <h2 class="text-lg font-bold text-slate-900">নতুন অ্যাকাউন্ট তৈরি করুন</h2>
            <p class="text-xs text-slate-500">আপনার সঠিক তথ্য দিয়ে রেজিস্ট্রেশন সম্পন্ন করুন</p>
          </div>

          <form onsubmit="window.handleRegisterForm(event)" class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">পূর্ণ নাম *</label>
              <input type="text" id="reg-fullname" required placeholder="আপনার পূর্ণ নাম" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">মোবাইল নম্বর *</label>
              <input type="tel" id="reg-phone" required placeholder="০১৭xxxxxxxx" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ইমেইল ঠিকানা *</label>
              <input type="email" id="reg-email" required placeholder="example@gmail.com" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">পাসওয়ার্ড *</label>
              <input type="password" id="reg-password" required minlength="6" placeholder="সর্বনিম্ন ৬ অক্ষর" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
            </div>

            <button type="submit" class="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl text-xs min-h-[44px] transition-colors">
              রেজিস্ট্রেশন সম্পূর্ণ করুন
            </button>
          </form>

          <hr class="border-slate-200">

          <div class="text-center space-y-2">
            <p class="text-xs text-slate-500">ইতিমধ্যে অ্যাকাউন্ট আছে?</p>
            <button onclick="window.toggleAuthMode('login')" class="text-xs font-bold text-emerald-700 hover:underline min-h-[44px]">
              সাইন ইন করুন
            </button>
          </div>
        </div>
      `;
      return;
    }

    containerEl.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 max-w-md mx-auto">
        <div class="text-center">
          <h2 class="text-lg font-bold text-slate-900">সাইন ইন করুন</h2>
          <p class="text-xs text-slate-500">আপনার একাউন্টে প্রবেশ করতে তথ্য দিন</p>
        </div>

        <form onsubmit="window.handleLoginForm(event)" class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ইমেইল ঠিকানা</label>
            <input type="email" id="login-email" required placeholder="example@gmail.com" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">পাসওয়ার্ড</label>
            <input type="password" id="login-password" required placeholder="******" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-600">
          </div>

          <button type="submit" class="w-full bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs min-h-[44px]">
            লগইন করুন
          </button>
        </form>

        <hr class="border-slate-200">

        <div class="text-center space-y-2">
          <p class="text-xs text-slate-500">নতুন অ্যাকাউন্ট তৈরি করবেন?</p>
          <button onclick="window.toggleAuthMode('register')" class="text-xs font-bold text-emerald-700 hover:underline min-h-[44px]">
            রেজিস্টার করুন
          </button>
        </div>
      </div>
    `;
    return;
  }

  containerEl.innerHTML = `
    <div class="space-y-4 max-w-2xl mx-auto">
      <!-- Header Banner Card -->
      <div class="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white rounded-2xl p-5 shadow-sm">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-2xl text-white border-2 border-emerald-300 shadow-inner shrink-0">
            ${(currentUserProfile?.fullName?.[0] || currentUser?.email?.[0] || 'U').toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-lg text-white truncate">${escapeHtml(currentUserProfile?.fullName || 'সম্মানিত গ্রাহক')}</h3>
            <p class="text-xs text-emerald-200 truncate">${escapeHtml(currentUser?.email || '')}</p>
            <div class="flex items-center gap-2 mt-2">
              <span class="inline-block text-[10px] bg-emerald-700/80 text-emerald-100 border border-emerald-500/50 px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase">
                ${currentUserProfile?.role === 'admin' ? '⚡ এডমিন' : '👤 গ্রাহক'}
              </span>
              <span class="text-[10px] text-emerald-300">
                ID: ${escapeHtml((currentUser?.uid || '').slice(0, 10))}...
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed User Account Info Card -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
        <div class="flex justify-between items-center border-b border-slate-100 pb-3">
          <h4 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            ব্যক্তিগত ও একাউন্ট তথ্য (Account Details)
          </h4>
          <button onclick="window.toggleEditProfileForm()" class="text-xs font-bold text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors min-h-[44px]">
            ✏️ তথ্য সম্পাদনা করুন
          </button>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="block text-[10px] text-slate-400 font-semibold mb-0.5">পূর্ণ নাম (Full Name)</span>
            <span class="font-bold text-slate-800">${escapeHtml(currentUserProfile?.fullName || 'নির্দিষ্ট করা নেই')}</span>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="block text-[10px] text-slate-400 font-semibold mb-0.5">ইমেইল ঠিকানা (Email Address)</span>
            <span class="font-bold text-slate-800 break-all">${escapeHtml(currentUser?.email || 'নির্দিষ্ট করা নেই')}</span>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="block text-[10px] text-slate-400 font-semibold mb-0.5">মোবাইল নম্বর (Phone Number)</span>
            <span class="font-bold text-slate-800">${escapeHtml(currentUserProfile?.phone || 'নির্দিষ্ট করা নেই')}</span>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="block text-[10px] text-slate-400 font-semibold mb-0.5">ইউজার আইডি (User UID)</span>
            <span class="font-mono text-[11px] text-slate-700 break-all">${escapeHtml(currentUser?.uid || '')}</span>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="block text-[10px] text-slate-400 font-semibold mb-0.5">একাউন্ট রোল (Role)</span>
            <span class="font-bold text-emerald-700 uppercase">${escapeHtml(currentUserProfile?.role || 'customer')}</span>
          </div>

          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="block text-[10px] text-slate-400 font-semibold mb-0.5">যোগদানের তারিখ (Joined Date)</span>
            <span class="font-bold text-slate-800">${currentUserProfile?.createdAt ? new Date(currentUserProfile.createdAt).toLocaleDateString('bn-BD') : 'তথ্য নেই'}</span>
          </div>
        </div>

        <!-- Default Shipping Address -->
        <div class="border-t border-slate-100 pt-3">
          <h5 class="text-xs font-bold text-slate-700 mb-2">ডিফল্ট ডেলিভারি ঠিকানা (Default Shipping Address)</h5>
          <div class="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs text-slate-700 space-y-1">
            <p><span class="font-bold">বিভাগ:</span> ${escapeHtml(currentUserProfile?.division || 'নির্দিষ্ট করা নেই')}</p>
            <p><span class="font-bold">জেলা:</span> ${escapeHtml(currentUserProfile?.district || 'নির্দিষ্ট করা নেই')}</p>
            <p><span class="font-bold">উপজেলা:</span> ${escapeHtml(currentUserProfile?.upazila || 'নির্দিষ্ট করা নেই')}</p>
            <p><span class="font-bold">এলাকা:</span> ${escapeHtml(currentUserProfile?.area || 'নির্দিষ্ট করা নেই')}</p>
            <p><span class="font-bold">বিস্তারিত ঠিকানা:</span> ${escapeHtml(currentUserProfile?.address || 'নির্দিষ্ট করা নেই')}</p>
          </div>
        </div>

        <!-- Edit Profile Hidden Form -->
        <div id="edit-profile-form-container" class="hidden border-t border-slate-200 pt-4">
          <h5 class="text-xs font-bold text-slate-800 mb-3">প্রোফাইল তথ্য আপডেট করুন</h5>
          <form onsubmit="window.handleUpdateProfileSubmit(event)" class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">পূর্ণ নাম *</label>
                <input type="text" id="edit-fullname" value="${escapeHtml(currentUserProfile?.fullName || '')}" required class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">মোবাইল নম্বর *</label>
                <input type="tel" id="edit-phone" value="${escapeHtml(currentUserProfile?.phone || '')}" required class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">বিভাগ</label>
                <input type="text" id="edit-division" value="${escapeHtml(currentUserProfile?.division || '')}" placeholder="ঢাকা" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">জেলা</label>
                <input type="text" id="edit-district" value="${escapeHtml(currentUserProfile?.district || '')}" placeholder="ঢাকা" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-1">উপজেলা</label>
                <input type="text" id="edit-upazila" value="${escapeHtml(currentUserProfile?.upazila || '')}" placeholder="ধানমন্ডি" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">এলাকা</label>
              <input type="text" id="edit-area" value="${escapeHtml(currentUserProfile?.area || '')}" placeholder="ধানমন্ডি ৩২" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-700 mb-1">বিস্তারিত ঠিকানা</label>
              <textarea id="edit-address" rows="2" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">${escapeHtml(currentUserProfile?.address || '')}</textarea>
            </div>

            <div class="flex gap-2 justify-end pt-1">
              <button type="button" onclick="window.toggleEditProfileForm()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold min-h-[44px]">বাতিল</button>
              <button type="submit" class="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-xl text-xs font-bold min-h-[44px]">সংরক্ষণ করুন</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Quick Options Card -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
        <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">দ্রুত নেভিগেশন</h4>
        
        <a href="#orders" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 border border-slate-100 min-h-[44px]">
          <span class="flex items-center gap-2">📦 আমার অর্ডারসমূহ</span>
          <span class="text-slate-400">→</span>
        </a>

        <a href="#chat" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 border border-slate-100 min-h-[44px]">
          <span class="flex items-center gap-2">💬 কাস্টমার সাপোর্ট চ্যাট</span>
          <span class="text-slate-400">→</span>
        </a>

        <a href="#cart" class="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 border border-slate-100 min-h-[44px]">
          <span class="flex items-center gap-2">🛒 শপিং কার্ট</span>
          <span class="text-slate-400">→</span>
        </a>

        ${currentUserProfile?.role === 'admin' ? `
          <a href="admin.html" target="_blank" class="flex items-center justify-between p-3 rounded-xl bg-purple-50 text-purple-800 text-xs font-bold border border-purple-200 min-h-[44px]">
            <span class="flex items-center gap-2">⚡ এডমিন প্যানেল (Admin Portal)</span>
            <span>↗</span>
          </a>
        ` : ''}

        <button onclick="window.triggerAppLogout()" class="w-full text-left p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors min-h-[44px] flex items-center justify-between mt-2">
          <span>🚪 একাউন্ট লগ আউট</span>
          <span>→</span>
        </button>
      </div>
    </div>
  `;
}

// Edit Profile Form Toggle
window.toggleEditProfileForm = function() {
  const formEl = document.getElementById("edit-profile-form-container");
  if (formEl) {
    formEl.classList.toggle("hidden");
  }
};

window.handleUpdateProfileSubmit = async function(event) {
  event.preventDefault();
  const fullName = document.getElementById("edit-fullname")?.value;
  const phone = document.getElementById("edit-phone")?.value;
  const division = document.getElementById("edit-division")?.value;
  const district = document.getElementById("edit-district")?.value;
  const upazila = document.getElementById("edit-upazila")?.value;
  const area = document.getElementById("edit-area")?.value;
  const address = document.getElementById("edit-address")?.value;

  try {
    await updateUserAddress({ fullName, phone, division, district, upazila, area, address });
    const mainContent = document.getElementById("main-content");
    if (mainContent) renderProfileView(mainContent);
  } catch (err) {
    console.error("Failed to update profile", err);
  }
};

// Login Form Submit Handler
window.handleLoginForm = async function(event) {
  event.preventDefault();
  const email = document.getElementById("login-email")?.value;
  const pass = document.getElementById("login-password")?.value;

  try {
    await loginUser(email, pass);
    handleHashRoute();
  } catch (err) {
    // Error handled in auth
  }
};

// Register Form Submit Handler
window.handleRegisterForm = async function(event) {
  event.preventDefault();
  const fullName = document.getElementById("reg-fullname")?.value;
  const phone = document.getElementById("reg-phone")?.value;
  const email = document.getElementById("reg-email")?.value;
  const password = document.getElementById("reg-password")?.value;

  try {
    await registerCustomer({ fullName, email, password, phone });
    authMode = "login";
    handleHashRoute();
  } catch (err) {
    // Error handled in auth
  }
};

window.triggerAppLogout = function() {
  logoutUser();
};

async function renderOrdersView(containerEl) {
  if (!currentUser) {
    containerEl.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md mx-auto my-6 space-y-3">
        <div class="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h3 class="text-base font-bold text-slate-900">সাইন ইন প্রয়োজন</h3>
        <p class="text-xs text-slate-500">আপনার অর্ডার ইতিহাস দেখতে অনুগ্রহ করে একাউন্টে সাইন ইন করুন।</p>
        <a href="#profile" class="inline-flex items-center justify-center bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs min-h-[44px]">
          সাইন ইন করুন
        </a>
      </div>
    `;
    return;
  }

  containerEl.innerHTML = `
    <div class="space-y-4 max-w-2xl mx-auto">
      <h2 class="text-base font-bold text-slate-900 border-l-4 border-emerald-600 pl-2">
        আমার অর্ডার হিস্ট্রি
      </h2>
      <div id="user-orders-list" class="space-y-3">
        <div class="py-8 text-center text-xs text-slate-400 bg-white border border-slate-100 rounded-xl">
          অর্ডার তথ্য লোড হচ্ছে...
        </div>
      </div>
    </div>
  `;

  const listEl = document.getElementById("user-orders-list");
  if (!listEl) return;

  try {
    let orders = [];
    if (db) {
      const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        orders = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }
    }

    if (orders.length === 0) {
      listEl.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <div class="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          </div>
          <h3 class="text-sm font-bold text-slate-800">কোনো অর্ডার পাওয়া যায়নি</h3>
          <p class="text-xs text-slate-500">আপনি এখনো কোনো অর্ডার করেননি।</p>
          <a href="#home" class="inline-flex items-center gap-2 bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-xs min-h-[44px]">
            কেনাকাটা শুরু করুন
          </a>
        </div>
      `;
      return;
    }

    listEl.innerHTML = orders.map(ord => {
      const statusMap = {
        pending: { label: "পেন্ডিং (অপেক্ষমাণ)", bg: "bg-amber-100 text-amber-800" },
        approved: { label: "অনুমোদিত", bg: "bg-blue-100 text-blue-800" },
        shipped: { label: "শিপড (শিপিং চলছে)", bg: "bg-purple-100 text-purple-800" },
        delivered: { label: "ডেলিভার্ড (সম্পন্ন)", bg: "bg-emerald-100 text-emerald-800" },
        cancelled: { label: "বাতিলকৃত", bg: "bg-red-100 text-red-800" }
      };
      const st = statusMap[ord.orderStatus] || { label: ord.orderStatus || 'পেন্ডিং', bg: "bg-slate-100 text-slate-800" };

      return `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div class="flex justify-between items-start border-b border-slate-100 pb-2">
            <div>
              <span class="text-xs font-bold text-emerald-800">অর্ডার #${ord.orderNumber || ord.id.slice(0,8)}</span>
              <p class="text-[10px] text-slate-400">${ord.createdAt ? new Date(ord.createdAt).toLocaleString('bn-BD') : ''}</p>
            </div>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${st.bg}">
              ${st.label}
            </span>
          </div>

          <div class="space-y-2">
            ${(ord.items || []).map(item => `
              <div class="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <img src="${item.image || 'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=100&q=80'}" class="w-10 h-10 object-cover rounded-lg bg-slate-200 shrink-0">
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.title || 'পণ্য')}</p>
                  <p class="text-[10px] text-slate-500">${formatPrice(item.discountPrice || item.price)} × ${item.quantity || 1}</p>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="bg-emerald-50/50 p-2.5 rounded-xl text-xs space-y-1">
            <div class="flex justify-between text-slate-600">
              <span>পেমেন্ট মাধ্যম:</span>
              <span class="font-bold uppercase">${ord.paymentMethod === 'cod' ? 'ক্যাশ অন ডেলিভারি' : ord.paymentMethod}</span>
            </div>
            <div class="flex justify-between text-slate-600">
              <span>ডেলিভারি ঠিকানা:</span>
              <span class="font-bold text-slate-800 text-right truncate max-w-[180px]">${escapeHtml(ord.customerInfo?.address || '')}, ${escapeHtml(ord.customerInfo?.district || '')}</span>
            </div>
            <div class="flex justify-between font-bold text-slate-900 border-t border-emerald-100 pt-1.5 mt-1">
              <span>সর্বমোট মূল্য:</span>
              <span class="text-emerald-700 font-extrabold">${formatPrice(ord.totalAmount || 0)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn("Failed to load user orders:", err);
    listEl.innerHTML = `<div class="py-4 text-center text-red-500 text-xs">অর্ডার লোড করতে সমস্যা হয়েছে</div>`;
  }
}

async function renderHelpView(containerEl) {
  containerEl.innerHTML = `
    <div class="space-y-4 max-w-2xl mx-auto">
      <div class="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white rounded-2xl p-6 text-center space-y-2 shadow-sm">
        <h2 class="text-lg font-bold">আপনবাজার হেল্প সেন্টার</h2>
        <p class="text-xs text-emerald-200">সচরাচর জিজ্ঞাসিত প্রশ্নাবলী ও তাত্ক্ষণিক সমাধান</p>
      </div>

      <div id="help-page-content" class="space-y-3">
        <div class="py-8 text-center text-xs text-slate-400 bg-white border border-slate-100 rounded-2xl">
          তথ্য লোড হচ্ছে...
        </div>
      </div>

      <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center space-y-2">
        <h3 class="text-xs font-bold text-emerald-900">আপনার কোনো নির্দিষ্ট প্রশ্ন বা সহায়তা প্রয়োজন?</h3>
        <p class="text-[11px] text-slate-600">আমাদের কাস্টমার কেয়ার টিম সর্বক্ষণ সহায়তায় নিয়োজিত।</p>
        <div class="flex gap-2 justify-center pt-1">
          <a href="#chat" class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs min-h-[44px] inline-flex items-center gap-1.5">
            💬 লাইভ চ্যাট করুন
          </a>
          <a href="#contact" class="bg-white border border-emerald-200 text-emerald-800 font-bold px-4 py-2 rounded-xl text-xs min-h-[44px] inline-flex items-center gap-1.5">
            📞 যোগাযোগ হটলাইন
          </a>
        </div>
      </div>
    </div>
  `;

  const contentEl = document.getElementById("help-page-content");
  if (!contentEl) return;

  let pageData = null;
  if (db) {
    try {
      const snap = await getDoc(doc(db, "settings", "pages_info"));
      if (snap.exists()) pageData = snap.data();
    } catch (e) {
      console.warn("Failed to load help page settings:", e);
    }
  }

  const faqs = pageData?.faqs || [
    { q: "কিভাবে অর্ডার করবো?", a: "পছন্দের পণ্য নির্বাচন করে 'কার্টে যোগ করুন' বা 'অর্ডার করুন' এ চাপুন। আপনার পূর্ণাঙ্গ ঠিকানা এবং ফোন নম্বর দিয়ে ক্যাশ অন ডেলিভারিতে সহজ অর্ডার দিন।" },
    { q: "ডেলিভারি চার্জ কত?", a: "পণ্য ও গন্তব্য অনুযায়ী ঢাকার মধ্যে ৬০ টাকা এবং ঢাকার বাইরে ১২০ টাকা ডেলিভারি চার্জ প্রযোজ্য।" },
    { q: "পণ্য পরিবর্তন বা রিটার্ন পলিসি কি?", a: "পণ্য পাওয়ার সময় যেকোনো সমস্যা থাকলে ডেলিভারিম্যানের সামনে চেক করে সহজ রিটার্ন করতে পারবেন।" }
  ];

  contentEl.innerHTML = `
    <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
        <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ${escapeHtml(pageData?.help_title || 'সাধারণ প্রশ্ন ও উত্তর (FAQs)')}
      </h3>

      <div class="space-y-3">
        ${faqs.map((faq, idx) => `
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
            <h4 class="text-xs font-bold text-slate-900 flex items-start gap-2">
              <span class="bg-emerald-600 text-white rounded-md px-1.5 py-0.5 text-[10px] font-bold">Q${idx + 1}</span>
              ${escapeHtml(faq.q)}
            </h4>
            <p class="text-xs text-slate-600 leading-relaxed pl-7">${escapeHtml(faq.a)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function renderContactView(containerEl) {
  containerEl.innerHTML = `
    <div class="space-y-4 max-w-2xl mx-auto">
      <div class="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white rounded-2xl p-6 text-center space-y-2 shadow-sm">
        <h2 class="text-lg font-bold">যোগাযোগ করুন</h2>
        <p class="text-xs text-emerald-200">যেকোনো প্রশ্ন বা তথ্যের জন্য সরাসরি আমাদের সাথে সংযুক্ত হন</p>
      </div>

      <div id="contact-page-content" class="space-y-3">
        <div class="py-8 text-center text-xs text-slate-400 bg-white border border-slate-100 rounded-2xl">
          যোগাযোগের তথ্য লোড হচ্ছে...
        </div>
      </div>
    </div>
  `;

  const contentEl = document.getElementById("contact-page-content");
  if (!contentEl) return;

  let data = null;
  if (db) {
    try {
      const snap = await getDoc(doc(db, "settings", "pages_info"));
      if (snap.exists()) data = snap.data();
    } catch (e) {
      console.warn("Failed to load contact settings:", e);
    }
  }

  const phone = data?.contact_phone || "+880 1700-000000";
  const email = data?.contact_email || "support@aponbazar.com";
  const whatsapp = data?.contact_whatsapp || "+880 1700-000000";
  const hours = data?.contact_hours || "প্রতিদিন সকাল ৯:০০ - রাত ১০:০০";
  const address = data?.contact_address || "ধানমন্ডি ৩২, ঢাকা-১২০৯, বাংলাদেশ";

  contentEl.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <a href="tel:${escapeHtml(phone)}" class="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:border-emerald-300 transition-colors">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1.001 1.001 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
        </div>
        <div class="min-w-0">
          <span class="block text-[10px] text-slate-400 font-semibold uppercase">কাস্টমার হটলাইন</span>
          <span class="text-xs font-bold text-slate-800 block truncate">${escapeHtml(phone)}</span>
          <span class="text-[10px] text-emerald-700 font-bold">কল করতে চাপুন →</span>
        </div>
      </a>

      <a href="https://wa.me/${escapeHtml(whatsapp.replace(/[^0-9]/g, ''))}" target="_blank" class="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:border-emerald-300 transition-colors">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        </div>
        <div class="min-w-0">
          <span class="block text-[10px] text-slate-400 font-semibold uppercase">হোয়াটসঅ্যাপ সাপোর্ট</span>
          <span class="text-xs font-bold text-slate-800 block truncate">${escapeHtml(whatsapp)}</span>
          <span class="text-[10px] text-emerald-700 font-bold">মেসেজ পাঠান →</span>
        </div>
      </a>

      <a href="mailto:${escapeHtml(email)}" class="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:border-emerald-300 transition-colors">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </div>
        <div class="min-w-0">
          <span class="block text-[10px] text-slate-400 font-semibold uppercase">অফিশিয়াল ইমেইল</span>
          <span class="text-xs font-bold text-slate-800 block truncate">${escapeHtml(email)}</span>
          <span class="text-[10px] text-emerald-700 font-bold">ইমেইল পাঠান →</span>
        </div>
      </a>

      <div class="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div class="min-w-0">
          <span class="block text-[10px] text-slate-400 font-semibold uppercase">অফিস সেবার সময়</span>
          <span class="text-xs font-bold text-slate-800 block">${escapeHtml(hours)}</span>
        </div>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
      <h3 class="text-xs font-bold text-slate-800 flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        প্রধান কার্যালয় ঠিকানা
      </h3>
      <p class="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 font-semibold">
        ${escapeHtml(address)}
      </p>
    </div>

    <div class="bg-emerald-800 text-white rounded-2xl p-5 text-center space-y-2 shadow-sm">
      <h3 class="text-sm font-bold">লাইভ কাস্টমার চ্যাটে সরাসরি কথা বলুন</h3>
      <p class="text-xs text-emerald-200">আমাদের প্রতিনিধির সাথে মেসেজিং এর মাধ্যমে কথা বলতে লাইভ চ্যাট শুরু করুন।</p>
      <a href="#chat" class="inline-flex items-center gap-2 bg-white text-emerald-800 font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm hover:bg-emerald-50 min-h-[44px]">
        💬 চ্যাট শুরু করুন
      </a>
    </div>
  `;
}

async function renderAboutView(containerEl) {
  containerEl.innerHTML = `
    <div class="space-y-4 max-w-2xl mx-auto">
      <div id="about-page-content" class="space-y-4">
        <div class="py-8 text-center text-xs text-slate-400 bg-white border border-slate-100 rounded-2xl">
          আমাদের তথ্য লোড হচ্ছে...
        </div>
      </div>
    </div>
  `;

  const contentEl = document.getElementById("about-page-content");
  if (!contentEl) return;

  let data = null;
  if (db) {
    try {
      const snap = await getDoc(doc(db, "settings", "pages_info"));
      if (snap.exists()) data = snap.data();
    } catch (e) {
      console.warn("Failed to load about page settings:", e);
    }
  }

  const title = data?.about_title || "আপনবাজার — আপনার বিশ্বাসী অনলাইন শপিং প্ল্যাটফর্ম";
  const desc = data?.about_desc || "আপনবাজার বাংলাদেশের অন্যতম সেরা ও নির্ভরযোগ্য মোবাইল ই-কমার্স প্ল্যাটফর্ম। আমরা সর্বোচ্চ মানের অর্গানিক খাবার, পোশাক, প্রসাধনী ও আধুনিক লাইফস্টাইল পণ্য সরাসরি গ্রাহকের দোরগোড়ায় পৌঁছে দিতে প্রতিশ্রুতিবদ্ধ।";
  const image = data?.about_image || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80";
  const rawHighlights = data?.about_highlights || "১০০% খাঁটি ও আসল পণ্যের নির্ভরযোগ্যতা\nসমগ্র বাংলাদেশে দ্রুততম ক্যাশ অন ডেলিভারি\n২৪/৭ তাৎক্ষণিক সাপোর্ট চ্যাট সুবিধা\nসহজ রিটার্ন ও রিপ্লেসমেন্ট গ্যারান্টি";
  const highlights = rawHighlights.split("\n").filter(h => h.trim().length > 0);

  contentEl.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl bg-emerald-900 text-white aspect-[21/9] shadow-sm">
      <img src="${image}" alt="About Banner" class="w-full h-full object-cover opacity-60">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent p-5 flex flex-col justify-end">
        <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">আমাদের সম্পর্কে</span>
        <h2 class="text-base font-bold text-white leading-tight">${escapeHtml(title)}</h2>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
      <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">আমাদের লক্ষ্য ও প্রতিশ্রুতি</h3>
      <p class="text-xs text-slate-700 leading-relaxed font-normal">${escapeHtml(desc)}</p>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">কেন আপনবাজার বেছে নেবেন?</h3>
      <div class="space-y-2">
        ${highlights.map(item => `
          <div class="flex items-start gap-2.5 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100/80 text-xs font-bold text-slate-800">
            <span class="text-emerald-700 shrink-0">✓</span>
            <span>${escapeHtml(item)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="bg-slate-900 text-white rounded-2xl p-5 text-center space-y-2 shadow-sm">
      <h3 class="text-sm font-bold">আজই কেনাকাটা শুরু করুন</h3>
      <p class="text-xs text-slate-300">আমাদের সেরা অফার ও ক্যাটাগরিগুলি ঘুরে দেখুন</p>
      <a href="#home" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-colors min-h-[44px]">
        🛍️ কেনাকাটা করুন
      </a>
    </div>
  `;
}

// Global Initialization
window.addEventListener("DOMContentLoaded", () => {
  initAuthObserver((profile) => {
    // Update drawer header info
    const drawerName = document.getElementById("drawer-user-name");
    const drawerEmail = document.getElementById("drawer-user-email");
    if (drawerName && drawerEmail) {
      if (profile) {
        drawerName.textContent = profile.fullName || "গ্রাহক";
        drawerEmail.textContent = profile.email;
      } else {
        drawerName.textContent = "স্বাগতম!";
        drawerEmail.textContent = "সাইন ইন করুন";
      }
    }
  });

  setupDrawerEvents();
  updateCartBadge();
  initPWA();

  window.addEventListener("hashchange", handleHashRoute);
  handleHashRoute();
});
