import './style.css';
import './pages.css';
import { initAuthListener, getCurrentUserData, loginUser, registerUser, loginWithGoogle, logoutUser } from './auth.js';
import { initShop, renderWishlistPage, renderCategorySections, renderProductCardHTML } from './shop.js';
import { initCart, renderCartPage, renderCheckoutPage, submitOrder } from './cart-checkout.js';
import { initChatSystem, subscribeToUserChatMessages } from './chat.js';
import { validateFirebaseConnection, db } from './firebase-config.js';
import { collection, getDocs } from 'firebase/firestore';
import { showToast, formatDate } from './core.js';

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
  await validateFirebaseConnection();
  
  // Init Modules
  initCart();
  initChatSystem();
  await initShop();
  await loadHeroBanners();

  // Auth Listener
  initAuthListener(onUserAuthStateChanged);

  // Router listener
  window.addEventListener('hashchange', handleRouteNavigation);
  handleRouteNavigation();

  // Bind Drawer Menu
  setupDrawerMenu();
  
  // Bind Global Search
  setupGlobalSearch();

  // Bind Auth Modal Forms
  setupAuthForms();

  // Bind Checkout Form
  setupCheckoutForm();
});

// --- Route Navigation ---
function handleRouteNavigation() {
  const hash = location.hash.replace('#', '') || 'home';
  
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
  
  const targetSec = document.getElementById(`${hash}-view`);
  if (targetSec) {
    targetSec.classList.remove('hidden');
  } else {
    document.getElementById('home-view')?.classList.remove('hidden');
  }

  // Update Bottom Nav active state
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    const navName = btn.getAttribute('data-nav');
    btn.classList.toggle('active', navName === hash);
  });

  // Execute view-specific loads
  if (hash === 'cart') renderCartPage();
  if (hash === 'checkout') renderCheckoutPage();
  if (hash === 'wishlist') renderWishlistPage();
  if (hash === 'chat') subscribeToUserChatMessages();
  if (hash === 'profile') renderProfilePage();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Bind Bottom Nav clicks
document.querySelectorAll('.bottom-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const nav = btn.getAttribute('data-nav');
    location.hash = `#${nav}`;
  });
});

// --- Hero Banner Slider ---
async function loadHeroBanners() {
  const slidesContainer = document.getElementById('banner-slides');
  if (!slidesContainer) return;

  let banners = [];
  try {
    const snap = await getDocs(collection(db, 'banners'));
    if (!snap.empty) {
      banners = snap.docs.map(d => d.data());
    }
  } catch (e) {}

  if (banners.length === 0) {
    banners = [{
      title: 'সামার মেগা সেল — ৫০% পর্যন্ত ছাড়',
      subtitle: 'সেরা মানের গ্যাজেট ও ফ্যাশন পন্যের উপর বিশেষ অফার!',
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200',
      buttonText: 'কেনাকাটা করুন'
    }];
  }

  slidesContainer.innerHTML = banners.map((b, idx) => `
    <div class="absolute inset-0 bg-cover bg-center flex items-center p-6 sm:p-10 transition-opacity duration-500 ${idx === 0 ? 'opacity-100' : 'opacity-0'}" style="background-image: linear-gradient(to right, rgba(13, 92, 58, 0.95), rgba(0,0,0,0.3)), url('${b.image}')">
      <div class="max-w-md text-white space-y-2">
        <h2 class="text-lg sm:text-2xl font-extrabold leading-tight">${b.title}</h2>
        <p class="text-xs sm:text-sm text-emerald-100 font-medium">${b.subtitle || ''}</p>
        <a href="#category-sections-container" class="inline-block btn-primary bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs sm:text-sm py-2 px-5 rounded-full mt-2">${b.buttonText || 'কেনাকাটা করুন'}</a>
      </div>
    </div>
  `).join('');
}

// --- User Auth State Change Handler ---
function onUserAuthStateChanged(userData) {
  const drawerName = document.getElementById('drawer-user-name');
  const drawerEmail = document.getElementById('drawer-user-email');
  const drawerAuthBtn = document.getElementById('drawer-auth-btn');
  const adminPortalLink = document.getElementById('admin-portal-link-wrap');

  if (userData) {
    if (drawerName) drawerName.textContent = userData.name || 'গ্রাহক';
    if (drawerEmail) drawerEmail.textContent = userData.email || '';
    if (drawerAuthBtn) {
      drawerAuthBtn.textContent = 'লগআউট';
      drawerAuthBtn.onclick = logoutUser;
    }
    // Show admin link if user role is admin
    if (userData.role === 'admin' && adminPortalLink) {
      adminPortalLink.classList.remove('hidden');
    }
  } else {
    if (drawerName) drawerName.textContent = 'অতিথি গ্রাহক';
    if (drawerEmail) drawerEmail.textContent = 'লগইন করুন';
    if (drawerAuthBtn) {
      drawerAuthBtn.textContent = 'লগইন করুন';
      drawerAuthBtn.onclick = () => openAuthModal('login');
    }
    if (adminPortalLink) adminPortalLink.classList.add('hidden');
  }
}

// --- Side Drawer Control ---
function setupDrawerMenu() {
  const btn = document.getElementById('hamburger-menu-btn');
  const drawer = document.getElementById('side-drawer');
  const overlay = document.getElementById('drawer-overlay');
  const closeBtn = document.getElementById('close-drawer-btn');

  function openDrawer() {
    drawer?.classList.add('active');
    overlay?.classList.add('active');
  }

  function closeDrawer() {
    drawer?.classList.remove('active');
    overlay?.classList.remove('active');
  }

  btn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  document.querySelectorAll('.drawer-link').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}

// --- Global Search ---
function setupGlobalSearch() {
  const searchInput = document.getElementById('global-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length > 1) {
      location.hash = '#home';
      // Filter visible category cards or product sections
      document.querySelectorAll('.product-card').forEach(card => {
        const title = card.querySelector('.product-title')?.textContent.toLowerCase() || '';
        card.style.display = title.includes(term) ? 'flex' : 'none';
      });
    } else {
      document.querySelectorAll('.product-card').forEach(card => card.style.display = 'flex');
    }
  });
}

// --- Auth Modal & Forms ---
let authMode = 'login'; // 'login' or 'register'

function openAuthModal(mode = 'login') {
  authMode = mode;
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-modal-title');
  const nameField = document.getElementById('auth-name-field');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('toggle-auth-mode-btn');

  if (mode === 'register') {
    title.textContent = 'নতুন একাউন্ট খুলুন';
    nameField.classList.remove('hidden');
    submitBtn.textContent = 'রেজিস্ট্রেশন করুন';
    toggleBtn.textContent = 'লগইন করুন';
  } else {
    title.textContent = 'লগইন করুন';
    nameField.classList.add('hidden');
    submitBtn.textContent = 'লগইন';
    toggleBtn.textContent = 'রেজিস্ট্রেশন করুন';
  }

  modal?.classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
}

function setupAuthForms() {
  document.getElementById('close-auth-modal')?.addEventListener('click', closeAuthModal);
  
  document.getElementById('toggle-auth-mode-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal(authMode === 'login' ? 'register' : 'login');
  });

  document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;

    try {
      if (authMode === 'register') {
        await registerUser(email, password, name);
      } else {
        await loginUser(email, password);
      }
      closeAuthModal();
    } catch (err) {}
  });

  document.getElementById('google-login-btn')?.addEventListener('click', async () => {
    try {
      await loginWithGoogle();
      closeAuthModal();
    } catch (e) {}
  });
}

// --- Checkout Form Handling ---
function setupCheckoutForm() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  // Toggle mobile banking trx id input
  document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      const mbInfo = document.getElementById('mobile-banking-info');
      if (val === 'bKash' || val === 'Nagad') {
        mbInfo?.classList.remove('hidden');
      } else {
        mbInfo?.classList.add('hidden');
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const customerInfo = {
      name: document.getElementById('cust-name').value,
      phone: document.getElementById('cust-phone').value,
      division: document.getElementById('cust-division').value,
      district: document.getElementById('cust-district').value,
      upazila: document.getElementById('cust-upazila').value,
      area: document.getElementById('cust-area').value,
      address: document.getElementById('cust-address').value,
      note: document.getElementById('cust-note').value
    };

    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'COD';
    const trxId = document.getElementById('trx-id')?.value || '';

    await submitOrder(customerInfo, paymentMethod, trxId);
  });
}

// --- Profile Page Render ---
function renderProfilePage() {
  const card = document.getElementById('profile-content-card');
  const user = getCurrentUserData();
  if (!card) return;

  if (!user) {
    card.innerHTML = `
      <div class="text-center py-8 space-y-3">
        <p class="text-slate-600 text-sm">প্রোফাইল দেখতে অনুগ্রহ করে লগইন করুন</p>
        <button onclick="window.openAuthModal('login')" class="btn-primary text-xs py-2 px-6">লগইন</button>
      </div>
    `;
    return;
  }

  card.innerHTML = `
    <div class="flex items-center gap-4 border-b border-slate-100 pb-4">
      <div class="w-16 h-16 rounded-full bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-2xl shadow-sm">
        ${user.name ? user.name.charAt(0) : 'U'}
      </div>
      <div>
        <h3 class="font-bold text-lg text-slate-900">${user.name}</h3>
        <p class="text-xs text-slate-500">${user.email}</p>
        <span class="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1">${user.role === 'admin' ? 'এডমিন' : 'গ্রাহক'}</span>
      </div>
    </div>
    
    <div class="space-y-3 text-xs text-slate-700">
      <div class="flex justify-between py-2 border-b border-slate-50"><span>ফোন নম্বর:</span><span class="font-semibold">${user.phone || 'দেওয়া হয়নি'}</span></div>
      <div class="flex justify-between py-2 border-b border-slate-50"><span>রেজিস্ট্রেশন তারিখ:</span><span class="font-semibold">${formatDate(user.createdAt)}</span></div>
    </div>

    <button onclick="window.logoutUser()" class="w-full btn-outline border-red-200 text-red-600 hover:bg-red-50 text-xs py-2.5">লগআউট করুন</button>
  `;
}

window.openAuthModal = openAuthModal;
window.logoutUser = logoutUser;
