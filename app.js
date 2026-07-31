import { initPWA, formatPrice, formatDate, showToast, escapeHtml, getValidImageUrl } from './core.js';
import { 
  onAuthChange, 
  loginUser, 
  registerUser, 
  loginWithGoogle,
  logoutUser, 
  resetPassword, 
  getCurrentUser, 
  getUserProfile, 
  updateUserAddress 
} from './auth.js';
import { 
  fetchBanners, 
  fetchCategories, 
  fetchCategoryProducts, 
  loadMoreCategoryProducts, 
  getProductById, 
  fetchProductReviews, 
  addProductReview, 
  createProductCardHTML, 
  toggleWishlist, 
  loadUserWishlist,
  getCurrentGridColumns
} from './shop.js';
import { 
  initCart, 
  getCart, 
  addToCart, 
  removeFromCart, 
  updateCartQuantity, 
  getSubtotal, 
  getTotalDeliveryCharge, 
  getCouponDiscount, 
  getGrandTotal, 
  applyCouponCode, 
  placeOrder,
  clearCart,
  loadCartFromFirestore,
  setBuyNowItem,
  clearBuyNowItem,
  getBuyNowItem,
  getAppliedCoupon,
  removeCoupon
} from './cart-checkout.js';
import { initLiveChat, sendChatMessage } from './chat.js';
import { db, collection, query, where, getDocs, getDoc, orderBy, onSnapshot, doc, updateDoc } from './firebase-config.js';

let activeTab = 'home';
let selectedCategory = 'সব';
let categoriesList = [];
let notificationUnsubscribe = null;
let userNotifications = [];
let lastColumns = 2; // Will be initialized on load
let activeCarouselIntervals = [];

function clearActiveCarouselIntervals() {
  activeCarouselIntervals.forEach(id => clearInterval(id));
  activeCarouselIntervals = [];
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize lastColumns with the current grid column count
  lastColumns = getCurrentGridColumns();

  // Load saved theme from localStorage instantly
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyAppTheme(savedTheme, false);
  }

  initPWA();
  initCart();

  setupGlobalEventListeners();
  initNotificationsListener();

  onAuthChange(async (user, profile) => {
    updateUserNavDisplay(user, profile);
    loadUserWishlist();
    initNotificationsListener();
    if (user) {
      await loadCartFromFirestore();
      if (profile && profile.theme) {
        applyAppTheme(profile.theme, false);
      }
    }
    const main = document.getElementById('app-content');
    if (main) {
      if (activeTab === 'chat') {
        renderChatView(main);
      } else if (activeTab === 'profile') {
        renderProfileView(main);
      } else if (activeTab === 'notifications') {
        renderNotificationsView(main);
      } else if (activeTab === 'cart') {
        renderCartView(main);
      } else if (activeTab === 'settings') {
        renderSettingsView(main);
      }
    }
  });

  // Load initial view
  renderView('home');

  // Handle window resize past column count breakpoints
  window.addEventListener('resize', () => {
    if (activeTab === 'home') {
      const currentCols = getCurrentGridColumns();
      if (currentCols !== lastColumns) {
        lastColumns = currentCols;
        renderCategoryProductGrids(selectedCategory);
      }
    }
  });
});

// Real-time Notifications Listener
function initNotificationsListener() {
  if (notificationUnsubscribe) {
    notificationUnsubscribe();
    notificationUnsubscribe = null;
  }

  const user = getCurrentUser();
  const unreadDot = document.getElementById('unread-dot');

  if (!user) {
    userNotifications = [];
    if (unreadDot) {
      unreadDot.classList.add('hidden');
    }
    return;
  }

  const q = query(collection(db, 'notifications'), where('userId', 'in', [user.uid, 'all']));

  notificationUnsubscribe = onSnapshot(q, (snapshot) => {
    userNotifications = [];
    let hasUnread = false;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const notif = { id: docSnap.id, ...data };
      userNotifications.push(notif);
      if (!notif.read) hasUnread = true;
    });

    // Sort in JS by createdAt descending
    userNotifications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (unreadDot) {
      if (hasUnread) unreadDot.classList.remove('hidden');
      else unreadDot.classList.add('hidden');
    }

    if (activeTab === 'notifications') {
      renderNotificationsUI(document.getElementById('app-content'));
    }
  }, (err) => {
    console.error('Notifications listener error:', err);
  });
}

// Setup Global Listeners
function setupGlobalEventListeners() {
  // Bottom Navigation
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = btn.dataset.tab;
      renderView(tab);
    });
  });

  // Header Notification Bell
  document.getElementById('notif-bell-btn')?.addEventListener('click', () => {
    renderView('notifications');
  });

  // Drawer Toggle
  const menuBtn = document.getElementById('menu-btn');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const drawerOverlay = document.getElementById('drawer-overlay');

  menuBtn?.addEventListener('click', () => drawerOverlay?.classList.add('active'));
  closeDrawerBtn?.addEventListener('click', () => drawerOverlay?.classList.remove('active'));
  drawerOverlay?.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) drawerOverlay.classList.remove('active');
  });

  // Drawer Nav Items
  document.querySelectorAll('.drawer-item[data-nav]').forEach(item => {
    item.addEventListener('click', () => {
      const navTarget = item.dataset.nav;
      drawerOverlay?.classList.remove('active');
      if (['profile', 'orders', 'wishlist', 'chat', 'notifications', 'settings'].includes(navTarget)) {
        renderView(navTarget);
      } else {
        renderStaticInfoView(navTarget);
      }
    });
  });

  // Drawer Auth Button
  document.getElementById('drawer-auth-btn')?.addEventListener('click', () => {
    drawerOverlay?.classList.remove('active');
    if (getCurrentUser()) {
      logoutUser();
    } else {
      document.getElementById('auth-modal')?.classList.remove('hidden');
    }
  });

  // Auth Modal
  document.getElementById('close-auth-modal')?.addEventListener('click', () => {
    document.getElementById('auth-modal')?.classList.add('hidden');
  });

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  tabLogin?.addEventListener('click', () => {
    tabLogin.className = 'flex-1 py-2 font-semibold text-teal-600 border-b-2 border-teal-600 text-center';
    tabRegister.className = 'flex-1 py-2 font-semibold text-slate-500 border-b-2 border-transparent text-center';
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.className = 'flex-1 py-2 font-semibold text-teal-600 border-b-2 border-teal-600 text-center';
    tabLogin.className = 'flex-1 py-2 font-semibold text-slate-500 border-b-2 border-transparent text-center';
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  // Password Show/Hide Toggle
  const setupPasswordToggle = (btnId, inputId, eyeId, eyeOffId) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const input = document.getElementById(inputId);
      const eye = document.getElementById(eyeId);
      const eyeOff = document.getElementById(eyeOffId);
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          eye?.classList.add('hidden');
          eyeOff?.classList.remove('hidden');
        } else {
          input.type = 'password';
          eye?.classList.remove('hidden');
          eyeOff?.classList.add('hidden');
        }
      }
    });
  };

  setupPasswordToggle('toggle-login-password', 'login-password', 'eye-login', 'eye-off-login');
  setupPasswordToggle('toggle-reg-password', 'reg-password', 'eye-reg', 'eye-off-reg');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'লগইন হচ্ছে...';
    }
    try {
      const user = await loginUser(identifier, password);
      if (user) {
        document.getElementById('auth-modal')?.classList.add('hidden');
        loginForm.reset();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const origText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'রেজিস্টার হচ্ছে...';
    }
    try {
      const user = await registerUser(email, password, name, phone);
      if (user) {
        document.getElementById('auth-modal')?.classList.add('hidden');
        registerForm.reset();
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    }
  });

  document.getElementById('forgot-password-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email || !email.includes('@')) {
      showToast('দয়া করে আপনার ইমেইল এড্রেসটি লিখুন', 'error');
      document.getElementById('login-email').focus();
      return;
    }
    try {
      await resetPassword(email);
    } catch (err) {}
  });

  const handleGoogleAuth = async (btn) => {
    if (!btn || btn.disabled) return;
    const origOpacity = btn.style.opacity;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    try {
      const user = await loginWithGoogle();
      if (user) {
        document.getElementById('auth-modal')?.classList.add('hidden');
      }
    } catch (err) {
      console.warn("Google login handler error:", err);
    } finally {
      btn.disabled = false;
      btn.style.opacity = origOpacity || '1';
    }
  };

  document.getElementById('google-login-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleGoogleAuth(e.currentTarget);
  });

  document.getElementById('google-register-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleGoogleAuth(e.currentTarget);
  });

  // Search input live filter
  const searchInput = document.getElementById('search-input');
  const clearSearch = document.getElementById('clear-search');

  searchInput?.addEventListener('input', () => {
    const term = searchInput.value.trim();
    if (term) clearSearch?.classList.remove('hidden');
    else clearSearch?.classList.add('hidden');
    
    if (activeTab === 'home' || activeTab === 'search') {
      renderSearchView(term);
    }
  });

  clearSearch?.addEventListener('click', () => {
    searchInput.value = '';
    clearSearch.classList.add('hidden');
    renderView('home');
  });
}

function updateUserNavDisplay(user, profile) {
  const nameDisp = document.getElementById('user-name-display');
  const emailDisp = document.getElementById('user-email-display');
  const authText = document.getElementById('drawer-auth-text');
  const avatar = document.getElementById('user-avatar');

  if (user) {
    if (nameDisp) nameDisp.textContent = profile?.fullName || user.displayName || 'গ্রাহক';
    if (emailDisp) emailDisp.textContent = user.email || '';
    if (authText) authText.textContent = 'লগআউট';
    if (avatar) avatar.textContent = (profile?.fullName || user.email || 'G')[0].toUpperCase();
  } else {
    if (nameDisp) nameDisp.textContent = 'অতিথি গ্রাহক';
    if (emailDisp) emailDisp.textContent = 'লগইন করুন';
    if (authText) authText.textContent = 'লগইন করুন';
    if (avatar) avatar.textContent = 'G';
  }
}

// Router & View Switcher
async function renderView(tabName) {
  clearActiveCarouselIntervals();
  activeTab = tabName;
  if (tabName !== 'checkout') {
    clearBuyNowItem();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const main = document.getElementById('app-content');
  if (!main) return;

  // Highlight active tab in bottom navigation
  document.querySelectorAll('.bottom-nav-item').forEach(b => {
    if (b.dataset.tab === tabName) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  if (tabName === 'home') {
    await renderHomeView(main);
  } else if (tabName === 'wishlist') {
    await renderWishlistView(main);
  } else if (tabName === 'cart') {
    renderCartView(main);
  } else if (tabName === 'checkout') {
    renderCheckoutView(main);
  } else if (tabName === 'chat') {
    renderChatView(main);
  } else if (tabName === 'notifications') {
    renderNotificationsView(main);
  } else if (tabName === 'profile' || tabName === 'orders') {
    renderProfileView(main, tabName === 'orders' ? 'orders' : 'info');
  } else if (tabName === 'settings') {
    renderSettingsView(main);
  }
}

// Notifications View
function renderNotificationsView(container) {
  renderNotificationsUI(container);
}

function renderNotificationsUI(container) {
  if (!container) return;

  const unreadCount = userNotifications.filter(n => !n.read).length;

  container.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <h2 class="font-bold text-slate-900 text-lg sm:text-xl">নোটিফিকেশনসমূহ</h2>
          ${unreadCount > 0 ? `<span class="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${unreadCount} নতুন</span>` : ''}
        </div>
        ${unreadCount > 0 ? `<button id="mark-all-read-btn" class="text-xs font-semibold text-teal-700 hover:underline">সব পঠিত চিহ্নিত করুন</button>` : ''}
      </div>

      <div id="notifications-list-box" class="space-y-3">
        ${userNotifications.length === 0 ? `
          <div class="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-2xs">
            <svg class="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            <p class="text-xs sm:text-sm font-medium text-slate-500">আপনার কোনো নোটিফিকেশন নেই</p>
          </div>
        ` : userNotifications.map(n => `
          <div class="p-4 bg-white rounded-2xl border ${n.read ? 'border-slate-200/80 text-slate-700' : 'border-teal-400 bg-teal-50/40 text-slate-900'} shadow-2xs relative group transition">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <div class="p-2 rounded-xl ${n.read ? 'bg-slate-100 text-slate-500' : 'bg-teal-100 text-teal-700'} shrink-0 mt-0.5">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                </div>
                <div>
                  <h4 class="font-bold text-xs sm:text-sm ${n.read ? 'text-slate-800' : 'text-teal-950'}">${escapeHtml(n.title)}</h4>
                  <p class="text-xs text-slate-600 leading-relaxed mt-1">${escapeHtml(n.body)}</p>
                  <span class="text-[10px] text-slate-400 block mt-2">${formatDate(n.createdAt)}</span>
                </div>
              </div>
              ${!n.read ? `
                <button class="mark-single-read-btn shrink-0 text-[10px] font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 px-2.5 py-1 rounded-lg transition" data-id="${n.id}">
                  পঠিত
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Mark all read listener
  container.querySelector('#mark-all-read-btn')?.addEventListener('click', async () => {
    for (const n of userNotifications) {
      if (!n.read && n.id) {
        try {
          await updateDoc(doc(db, 'notifications', n.id), { read: true });
        } catch (e) {
          console.error('Mark read error:', e);
        }
      }
    }
  });

  // Mark single read listener
  container.querySelectorAll('.mark-single-read-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const notifId = btn.dataset.id;
      if (notifId) {
        try {
          await updateDoc(doc(db, 'notifications', notifId), { read: true });
        } catch (e) {
          console.error('Mark read error:', e);
        }
      }
    });
  });
}

// Render Banner Slider (Only displays banners added from admin page)
function renderBannerSlider(container, banners) {
  if (!banners || banners.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  function handleBannerClick(b) {
    if (b && b.linkedCategoryId) {
      selectedCategory = b.linkedCategoryId;
      const chipsContainer = document.getElementById('category-chips-container');
      if (chipsContainer) {
        chipsContainer.querySelectorAll('.category-chip').forEach(c => {
          if (c.dataset.cat === b.linkedCategoryId) {
            c.classList.add('active');
          } else {
            c.classList.remove('active');
          }
        });
      }
      renderCategoryProductGrids(b.linkedCategoryId);
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  }

  if (banners.length === 1) {
    const b = banners[0];
    container.innerHTML = `
      <div class="hero-slider-container ${b.linkedCategoryId ? 'cursor-pointer' : ''}" id="single-banner-click">
        <div class="hero-slide" style="background-image: url('${escapeHtml(b.imageUrl)}')">
          <div class="hero-overlay"></div>
          <div class="relative z-10 text-white max-w-lg">
            ${b.title ? `<h1 class="text-lg sm:text-2xl font-bold">${escapeHtml(b.title)}</h1>` : ''}
            ${b.subtitle ? `<p class="text-xs sm:text-sm opacity-90 mt-0.5">${escapeHtml(b.subtitle)}</p>` : ''}
          </div>
        </div>
      </div>
    `;
    if (b.linkedCategoryId) {
      container.querySelector('#single-banner-click')?.addEventListener('click', () => handleBannerClick(b));
    }
    return;
  }

  // Multiple banners
  let currentIndex = 0;
  let autoSlideTimer = null;

  const slidesHtml = banners.map((b, i) => `
    <div class="hero-slide-item transition-opacity duration-500 absolute inset-0 ${i === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'} ${b.linkedCategoryId ? 'cursor-pointer' : ''}" data-slide-index="${i}" data-cat-link="${escapeHtml(b.linkedCategoryId || '')}">
      <div class="hero-slide h-full" style="background-image: url('${escapeHtml(b.imageUrl)}')">
        <div class="hero-overlay"></div>
        <div class="relative z-10 text-white max-w-lg">
          ${b.title ? `<h1 class="text-lg sm:text-2xl font-bold">${escapeHtml(b.title)}</h1>` : ''}
          ${b.subtitle ? `<p class="text-xs sm:text-sm opacity-90 mt-0.5">${escapeHtml(b.subtitle)}</p>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  const dotsHtml = banners.map((_, i) => `
    <button class="slider-dot ${i === 0 ? 'bg-white' : 'bg-white/50'} transition-all" style="width: 6px; height: 6px; border-radius: 50%;" data-dot-index="${i}"></button>
  `).join('');

  container.innerHTML = `
    <div class="hero-slider-container relative aspect-[21/8] sm:aspect-[24/7] overflow-hidden rounded-2xl bg-slate-900">
      ${slidesHtml}
      
      <!-- Controls -->
      <button id="slider-prev-btn" aria-label="Previous slide" class="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/40 text-white flex items-center justify-center hover:bg-slate-900/80 transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <button id="slider-next-btn" aria-label="Next slide" class="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/40 text-white flex items-center justify-center hover:bg-slate-900/80 transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
      </button>

      <!-- Dots -->
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
        ${dotsHtml}
      </div>
    </div>
  `;

  function goToSlide(index) {
    currentIndex = (index + banners.length) % banners.length;
    const slideItems = container.querySelectorAll('.hero-slide-item');
    const dots = container.querySelectorAll('.slider-dot');

    slideItems.forEach((item, idx) => {
      if (idx === currentIndex) {
        item.classList.remove('opacity-0', 'z-0', 'pointer-events-none');
        item.classList.add('opacity-100', 'z-10');
      } else {
        item.classList.remove('opacity-100', 'z-10');
        item.classList.add('opacity-0', 'z-0', 'pointer-events-none');
      }
    });

    dots.forEach((dot, idx) => {
      if (idx === currentIndex) {
        dot.className = 'slider-dot bg-white transition-all';
      } else {
        dot.className = 'slider-dot bg-white/50 transition-all';
      }
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '50%';
    });
  }

  function startTimer() {
    stopTimer();
    autoSlideTimer = setInterval(() => {
      goToSlide(currentIndex + 1);
    }, 4000);
  }

  function stopTimer() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
  }

  container.querySelector('#slider-prev-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goToSlide(currentIndex - 1);
    startTimer();
  });

  container.querySelector('#slider-next-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    goToSlide(currentIndex + 1);
    startTimer();
  });

  container.querySelectorAll('.slider-dot').forEach((dot, idx) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      goToSlide(idx);
      startTimer();
    });
  });

  container.querySelectorAll('.hero-slide-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      const banner = banners[idx];
      if (banner && banner.linkedCategoryId) {
        handleBannerClick(banner);
      }
    });
  });

  startTimer();
}

// Render Home View
async function renderHomeView(container) {
  container.innerHTML = `
    <!-- Hero Banner Slider & Side Banner Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5" id="hero-section-grid">
      <!-- Hero Banner Slider -->
      <section id="hero-slider-section" class="md:col-span-3">
        <div class="hero-slider-container skeleton aspect-[21/8] sm:aspect-[24/7] w-full"></div>
      </section>

      <!-- Static Side Banner -->
      <section id="hero-side-banner-section" class="md:col-span-1 hidden">
      </section>
    </div>

    <!-- Categories Horizontal Scroll -->
    <section class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-bold text-slate-800 text-sm sm:text-base">ক্যাটাগরি সমূহ</h2>
      </div>
      <div id="category-chips-container" class="category-scroll">
        <div class="category-chip active" data-cat="সব">সব</div>
      </div>
    </section>

    <!-- Category Product Grid Sections -->
    <div id="category-sections-wrapper" class="space-y-8">
      <div class="skeleton h-60 w-full rounded-2xl"></div>
    </div>
  `;

  // Fetch Banners
  fetchBanners().then(banners => {
    const sliderContainer = document.getElementById('hero-slider-section');
    if (!sliderContainer) return;

    // Filter slider and side banners
    const sliderBanners = banners.filter(b => b.type !== 'side');
    const sideBanners = banners.filter(b => b.type === 'side');

    renderBannerSlider(sliderContainer, sliderBanners);

    const sideContainer = document.getElementById('hero-side-banner-section');
    if (sideContainer) {
      if (sideBanners.length > 0) {
        const activeSideBanner = sideBanners[0];
        sliderContainer.className = 'md:col-span-2';
        sideContainer.className = 'md:col-span-1';
        sideContainer.classList.remove('hidden');

        sideContainer.innerHTML = `
          <div class="side-banner-container relative aspect-[21/8] md:aspect-[12/7] overflow-hidden rounded-2xl bg-slate-900 shadow-xs cursor-pointer h-full" id="side-banner-click">
            <div class="side-slide h-full w-full bg-cover bg-center flex items-end p-4 relative" style="background-image: url('${escapeHtml(activeSideBanner.imageUrl)}')">
              <div class="hero-overlay"></div>
              <div class="relative z-10 text-white">
                ${activeSideBanner.title ? `<h2 class="text-sm md:text-base font-bold">${escapeHtml(activeSideBanner.title)}</h2>` : ''}
                ${activeSideBanner.subtitle ? `<p class="text-[10px] md:text-xs opacity-95 mt-0.5">${escapeHtml(activeSideBanner.subtitle)}</p>` : ''}
              </div>
            </div>
          </div>
        `;

        if (activeSideBanner.linkedCategoryId) {
          sideContainer.querySelector('#side-banner-click')?.addEventListener('click', () => {
            selectedCategory = activeSideBanner.linkedCategoryId;
            const chipsContainer = document.getElementById('category-chips-container');
            if (chipsContainer) {
              chipsContainer.querySelectorAll('.category-chip').forEach(c => {
                if (c.dataset.cat === activeSideBanner.linkedCategoryId) {
                  c.classList.add('active');
                } else {
                  c.classList.remove('active');
                }
              });
            }
            renderCategoryProductGrids(activeSideBanner.linkedCategoryId);
            window.scrollTo({ top: 400, behavior: 'smooth' });
          });
        }
      } else {
        sliderContainer.className = 'md:col-span-3';
        sideContainer.classList.add('hidden');
      }
    }
  });

  // Fetch Categories
  categoriesList = await fetchCategories();
  const chipsContainer = document.getElementById('category-chips-container');
  if (chipsContainer) {
    chipsContainer.innerHTML = `<div class="category-chip ${selectedCategory === 'সব' ? 'active' : ''}" data-cat="সব">সব</div>`;
    categoriesList.forEach(c => {
      chipsContainer.insertAdjacentHTML('beforeend', `<div class="category-chip ${selectedCategory === c.name ? 'active' : ''}" data-cat="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`);
    });

    chipsContainer.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chipsContainer.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedCategory = chip.dataset.cat;
        renderCategoryProductGrids(selectedCategory);
      });
    });
  }

  // Render Category Grids
  await renderCategoryProductGrids(selectedCategory);
}

// Render Category Product Grids (2 cols x 2 rows = 4 products max initially, plus "আরও" link)
async function renderCategoryProductGrids(catFilter = 'সব') {
  clearActiveCarouselIntervals();
  const wrapper = document.getElementById('category-sections-wrapper');
  if (!wrapper) return;

  wrapper.innerHTML = '';

  let catsToRender = [];
  if (catFilter && catFilter !== 'সব') {
    catsToRender = [{ name: catFilter }];
  } else if (categoriesList.length > 0) {
    catsToRender = categoriesList;
  } else {
    catsToRender = [{ name: 'সব' }];
  }

  for (const cat of catsToRender) {
    const section = document.createElement('section');
    section.className = 'bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs';

    const headerHtml = `
      <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <h3 class="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-teal-600"></span>
          ${escapeHtml(cat.name)}
        </h3>
      </div>
    `;

    section.innerHTML = headerHtml + `
      <div class="product-grid carousel-active" id="grid-${cat.name}"></div>
      <div class="carousel-dots" id="dots-${cat.name}"></div>
    `;
    wrapper.appendChild(section);

    const gridContainer = section.querySelector(`#grid-${cat.name}`);
    const dotsContainer = section.querySelector(`#dots-${cat.name}`);

    // Fetch initial products (2 rows x column count)
    const initialLimit = getCurrentGridColumns() * 2;
    const { products, hasMore } = await fetchCategoryProducts(cat.name, initialLimit);

    if (products.length === 0) {
      gridContainer.innerHTML = `<div class="col-span-2 sm:col-span-3 text-center py-6 text-xs text-slate-400">এই ক্যাটাগরিতে কোনো প্রোডাক্ট পাওয়া যায়নি</div>`;
      if (dotsContainer) dotsContainer.style.display = 'none';
      continue;
    }

    products.forEach(p => {
      gridContainer.insertAdjacentHTML('beforeend', createProductCardHTML(p));
    });

    // Setup dots for the horizontal carousel
    setupCarouselDots(cat.name, gridContainer, dotsContainer, products.length);

    // Mandatory "আরও" (Load More) button centered at bottom of grid section if more items exist
    if (hasMore) {
      const footerContainer = document.createElement('div');
      footerContainer.className = 'w-full flex justify-center mt-6 mb-4';
      
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.innerHTML = `আরও <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;

      loadMoreBtn.addEventListener('click', () => {
        loadMoreCategoryProducts(cat.name, gridContainer, loadMoreBtn);
      });

      footerContainer.appendChild(loadMoreBtn);
      section.appendChild(footerContainer);
    }
  }

  attachProductCardEvents();
}

// Setup horizontal carousel dots navigation
function setupCarouselDots(catName, container, dotsContainer, totalProducts) {
  if (!dotsContainer) return;
  dotsContainer.innerHTML = '';

  const columns = getCurrentGridColumns();
  const totalPages = Math.ceil(totalProducts / columns);

  if (totalPages <= 1) {
    dotsContainer.style.display = 'none';
    return;
  }

  dotsContainer.style.display = 'flex';

  // Create dot buttons
  for (let i = 0; i < totalPages; i++) {
    const dot = document.createElement('button');
    dot.className = `carousel-dot${i === 0 ? ' active' : ''}`;
    dot.title = `Page ${i + 1}`;
    dot.setAttribute('aria-label', `Go to page ${i + 1}`);
    
    dot.addEventListener('click', () => {
      const targetScrollLeft = i * container.clientWidth;
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    });

    dotsContainer.appendChild(dot);
  }

  // Monitor scroll to update active dot
  const handleScroll = () => {
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth || 1;
    const activeIndex = Math.min(
      totalPages - 1,
      Math.max(0, Math.round(scrollLeft / width))
    );

    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, idx) => {
      if (idx === activeIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  };

  container.addEventListener('scroll', handleScroll);
  container._carouselScrollHandler = handleScroll;

  // Clear existing interval on this container if any
  if (container._carouselIntervalId) {
    clearInterval(container._carouselIntervalId);
  }

  // Auto-scroll loop every 4 seconds (4000ms)
  const intervalId = setInterval(() => {
    // Self-destruct if the carousel has been detached or removed from DOM
    if (!document.body.contains(container)) {
      clearInterval(intervalId);
      return;
    }
    const currentScrollLeft = container.scrollLeft;
    const width = container.clientWidth || 1;
    const activeIndex = Math.min(
      totalPages - 1,
      Math.max(0, Math.round(currentScrollLeft / width))
    );
    let nextIndex = activeIndex + 1;
    if (nextIndex >= totalPages) {
      nextIndex = 0;
    }
    container.scrollTo({ left: nextIndex * width, behavior: 'smooth' });
  }, 4000);

  container._carouselIntervalId = intervalId;
  activeCarouselIntervals.push(intervalId);
}

// Live Search View
async function renderSearchView(searchTerm) {
  const main = document.getElementById('app-content');
  if (!main) return;

  main.innerHTML = `
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-bold text-slate-800 text-base">খোঁজার ফলাফল: "${escapeHtml(searchTerm)}"</h2>
    </div>
    <div id="search-grid" class="product-grid"></div>
  `;

  const grid = document.getElementById('search-grid');
  try {
    const snap = await getDocs(collection(db, 'products'));
    const term = searchTerm.toLowerCase();
    const matched = [];
    snap.forEach(d => {
      const data = d.data();
      if ((data.name && data.name.toLowerCase().includes(term)) || (data.category && data.category.toLowerCase().includes(term))) {
        matched.push({ id: d.id, ...data });
      }
    });

    if (matched.length === 0) {
      grid.innerHTML = `<div class="col-span-2 text-center py-10 text-slate-400 text-sm">কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি</div>`;
    } else {
      matched.forEach(p => grid.insertAdjacentHTML('beforeend', createProductCardHTML(p)));
      attachProductCardEvents();
    }
  } catch (err) {
    console.error('Search error:', err);
  }
}

// Attach Event Listeners to Product Cards (View details, Add to cart, Wishlist)
function attachProductCardEvents() {
  document.querySelectorAll('.view-product-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      showProductDetailsModal(id);
    });
  });

  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const product = await getProductById(id);
      if (product) {
        addToCart(product, 1);
      }
    });
  });

  document.querySelectorAll('.buy-now-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const product = await getProductById(id);
      if (product) {
        setBuyNowItem(product, 1);
        renderView('checkout');
      }
    });
  });

  document.querySelectorAll('.wish-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await toggleWishlist(id);
      if (activeTab === 'wishlist') {
        const main = document.getElementById('app-content');
        if (main) renderWishlistView(main);
      }
    });
  });
}

// Product Details Modal View
async function showProductDetailsModal(productId) {
  const product = await getProductById(productId);
  if (!product) {
    showToast('প্রোডাক্টটি পাওয়া যায়নি', 'error');
    return;
  }

  const reviews = await fetchProductReviews(productId);
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image || 'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=400&q=80'];

  const deliveryCharge = Number(product.deliveryCharge) || 0;
  const deliveryLabel = deliveryCharge === 0 ? 'ফ্রি ডেলিভারি' : `ডেলিভারিচার্জ ${formatPrice(deliveryCharge)}`;

  const currentPrice = product.discountPrice ? Number(product.discountPrice) : Number(product.price);
  const originalPrice = product.discountPrice ? Number(product.price) : null;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200';
  modal.id = 'product-details-modal';

  modal.innerHTML = `
    <div class="bg-white w-full max-w-2xl max-h-[90vh] max-h-[90dvh] rounded-t-2xl sm:rounded-2xl overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-6 shadow-2xl relative flex flex-col gap-4">
      <button id="close-details-btn" class="absolute top-4 right-4 z-10 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      <!-- Main Image Preview -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="w-full aspect-square rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
            <img id="main-prod-img" src="${getValidImageUrl(images[0])}" class="w-full h-full object-cover" />
          </div>
          <!-- Thumbnails -->
          ${images.length > 1 ? `
            <div class="flex gap-2 mt-2 overflow-x-auto pb-1">
              ${images.map((img, idx) => `
                <img src="${getValidImageUrl(img)}" class="thumb-img w-12 h-12 rounded-lg object-cover border-2 ${idx === 0 ? 'border-teal-600' : 'border-slate-200'} cursor-pointer" data-url="${getValidImageUrl(img)}" />
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Details Info -->
        <div class="flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold uppercase bg-teal-100 text-teal-800 px-2 py-0.5 rounded">${escapeHtml(product.category)}</span>
              ${product.brand ? `<span class="text-xs text-slate-500 font-medium">ব্র্যান্ড: ${escapeHtml(product.brand)}</span>` : ''}
            </div>
            <h2 class="text-lg font-bold text-slate-900 leading-snug">${escapeHtml(product.name)}</h2>
            <p class="text-xs text-slate-400 mt-0.5">SKU: ${escapeHtml(product.sku || 'N/A')}</p>

            <div class="flex items-baseline gap-2 mt-3">
              <span class="text-2xl font-extrabold text-teal-700">${formatPrice(currentPrice)}</span>
              ${originalPrice ? `<span class="text-sm text-slate-400 line-through">${formatPrice(originalPrice)}</span>` : ''}
            </div>

            <!-- Per Product Delivery Charge Badge -->
            <div class="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium border border-emerald-200">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              <span>${deliveryLabel}</span>
            </div>
          </div>

          <!-- Quantity Selector & Actions -->
          <div class="space-y-3 pt-3 border-t border-slate-100">
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-slate-700">পরিমাণ:</span>
              <div class="flex items-center border border-slate-300 rounded-lg">
                <button id="qty-minus" class="px-3 py-1 font-bold text-slate-600 hover:bg-slate-100">-</button>
                <span id="qty-val" class="px-3 py-1 font-semibold text-sm">1</span>
                <button id="qty-plus" class="px-3 py-1 font-bold text-slate-600 hover:bg-slate-100">+</button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button id="modal-add-cart" class="add-to-cart-btn py-2.5 font-bold rounded text-sm transition">কার্টে যোগ করুন</button>
              <button id="modal-buy-now" class="buy-now-btn py-2.5 font-bold rounded text-sm transition">এখনই কিনুন</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Description & Specs -->
      <div class="pt-4 border-t border-slate-200">
        <h3 class="font-bold text-slate-800 text-sm mb-1">বিবরণ</h3>
        <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">${escapeHtml(product.description || 'কোনো বিবরণ নেই')}</p>
      </div>

      <!-- Reviews Section -->
      <div class="pt-4 border-t border-slate-200">
        <h3 class="font-bold text-slate-800 text-sm mb-2">গ্রাহকদের মতামত ও রিভিউ (${reviews.length})</h3>
        
        <!-- Add Review Form -->
        <form id="add-review-form" class="mb-4 bg-slate-50 p-3 rounded-xl space-y-2 border border-slate-200">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-700">রেটিং দিন:</span>
            <select id="review-rating" class="text-xs border border-slate-300 rounded px-2 py-1">
              <option value="5">⭐⭐⭐⭐⭐ (৫/৫)</option>
              <option value="4">⭐⭐⭐⭐ (৪/৫)</option>
              <option value="3">⭐⭐⭐ (৩/৫)</option>
              <option value="2">⭐⭐ (২/৫)</option>
              <option value="1">⭐ (১/৫)</option>
            </select>
          </div>
          <textarea id="review-text" required placeholder="আপনার মন্তব্য লিখুন..." class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none"></textarea>
          <button type="submit" class="px-3 py-1.5 bg-slate-800 text-white font-semibold text-xs rounded-lg hover:bg-slate-900">রিভিউ জমা দিন</button>
        </form>

        <div class="space-y-2 max-h-40 overflow-y-auto">
          ${reviews.length === 0 ? `<p class="text-xs text-slate-400">এখনো কোনো রিভিউ দেওয়া হয়নি। প্রথম রিভিউ দিন!</p>` : reviews.map(r => `
            <div class="p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-100">
              <div class="flex items-center justify-between font-semibold text-slate-800">
                <span>${escapeHtml(r.userName)}</span>
                <span class="text-amber-500">★ ${r.rating}</span>
              </div>
              <p class="text-slate-600 mt-1">${escapeHtml(r.comment)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Modal events
  modal.querySelector('#close-details-btn').addEventListener('click', () => modal.remove());
  
  // Image switching
  modal.querySelectorAll('.thumb-img').forEach(img => {
    img.addEventListener('click', () => {
      modal.querySelectorAll('.thumb-img').forEach(i => i.classList.replace('border-teal-600', 'border-slate-200'));
      img.classList.replace('border-slate-200', 'border-teal-600');
      modal.querySelector('#main-prod-img').src = img.dataset.url;
    });
  });

  // Qty selector
  let qty = 1;
  const qtyVal = modal.querySelector('#qty-val');
  modal.querySelector('#qty-minus').addEventListener('click', () => {
    if (qty > 1) { qty--; qtyVal.textContent = qty; }
  });
  modal.querySelector('#qty-plus').addEventListener('click', () => {
    qty++; qtyVal.textContent = qty;
  });

  // Actions
  modal.querySelector('#modal-add-cart').addEventListener('click', () => {
    addToCart(product, qty);
  });

  modal.querySelector('#modal-buy-now').addEventListener('click', () => {
    setBuyNowItem(product, qty);
    modal.remove();
    renderView('checkout');
  });

  // Review submit
  modal.querySelector('#add-review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = modal.querySelector('#review-rating').value;
    const c = modal.querySelector('#review-text').value;
    const ok = await addProductReview(productId, r, c);
    if (ok) modal.remove();
  });
}

// Wishlist View
async function renderWishlistView(container) {
  container.innerHTML = `
    <div class="mb-4">
      <h2 class="font-bold text-slate-900 text-lg">আমার উইশলিস্ট</h2>
    </div>
    <div id="wishlist-grid" class="product-grid">
      <div class="col-span-2 text-center py-10 text-slate-400 text-sm">উইশলিস্ট লোড হচ্ছে...</div>
    </div>
  `;

  const user = getCurrentUser();
  if (!user) {
    container.querySelector('#wishlist-grid').innerHTML = `
      <div class="col-span-2 text-center py-10">
        <p class="text-sm text-slate-500 mb-3">উইশলিস্ট দেখতে অনুগ্রহ করে লগইন করুন</p>
        <button id="wish-login-btn" class="px-4 py-2 bg-teal-700 text-white font-semibold rounded-lg text-xs">লগইন করুন</button>
      </div>
    `;
    container.querySelector('#wish-login-btn')?.addEventListener('click', () => {
      document.getElementById('auth-modal')?.classList.remove('hidden');
    });
    return;
  }

  try {
    const productIds = [];
    
    const wishRef = doc(db, 'wishlist', user.uid);
    const snap = await getDoc(wishRef);
    if (snap.exists()) {
      const data = snap.data();
      const itemsArr = data.products || data.items;
      if (Array.isArray(itemsArr)) {
        itemsArr.forEach(pid => {
          if (pid && typeof pid === 'string' && !productIds.includes(pid)) {
            productIds.push(pid);
          }
        });
      }
    }

    const grid = container.querySelector('#wishlist-grid');
    if (grid) {
      grid.innerHTML = '';

      if (productIds.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center py-10 text-slate-400 text-sm">আপনার উইশলিস্টে কোনো প্রোডাক্ট নেই</div>`;
        return;
      }

      for (const pid of productIds) {
        const p = await getProductById(pid);
        if (p) {
          grid.insertAdjacentHTML('beforeend', createProductCardHTML(p));
        }
      }
      attachProductCardEvents();
    }
  } catch (err) {
    console.error('Wishlist view error:', err);
    const grid = container.querySelector('#wishlist-grid');
    if (grid) {
      grid.innerHTML = `<div class="col-span-2 text-center py-10 text-red-500 text-sm">উইশলিস্ট লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।</div>`;
    }
  }
}

// Cart View
function renderCartView(container) {
  const cart = getCart();
  const subtotal = getSubtotal();
  const deliveryTotal = getTotalDeliveryCharge();
  const discount = getCouponDiscount();
  const grandTotal = getGrandTotal();

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-slate-200 p-6">
        <svg class="w-16 h-16 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        <h3 class="font-bold text-slate-800 text-base mb-1">আপনার কার্ট খালি</h3>
        <p class="text-xs text-slate-500 mb-4">আপনার পছন্দের সেরা প্রোডাক্টগুলো কার্টে যোগ করুন</p>
        <button id="continue-shop-btn" class="px-5 py-2.5 bg-teal-700 text-white font-bold rounded-lg text-xs hover:bg-teal-800 transition">কেনাকাটা করুন</button>
      </div>
    `;
    container.querySelector('#continue-shop-btn')?.addEventListener('click', () => renderView('home'));
    return;
  }

  container.innerHTML = `
    <h2 class="font-bold text-slate-900 text-lg mb-4">শপিং কার্ট (${cart.length})</h2>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Item List -->
      <div class="lg:col-span-2 space-y-3">
        ${cart.map(item => `
          <div class="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
            <img src="${getValidImageUrl(item.image)}" class="w-16 h-16 object-cover rounded-lg bg-slate-100 shrink-0" />
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-slate-800 text-xs sm:text-sm truncate">${escapeHtml(item.name)}</h4>
              <div class="text-xs font-bold text-teal-700 mt-0.5">${formatPrice(item.price)}</div>
              <div class="text-[10px] text-slate-500">ডেলিভারি: ${item.deliveryCharge === 0 ? 'ফ্রি' : formatPrice(item.deliveryCharge)}</div>
            </div>

            <!-- Qty controls -->
            <div class="flex items-center border border-slate-300 rounded-lg">
              <button class="qty-btn-minus px-2 py-0.5 text-xs font-bold text-slate-600" data-id="${item.id}">-</button>
              <span class="px-2 py-0.5 text-xs font-semibold">${item.qty}</span>
              <button class="qty-btn-plus px-2 py-0.5 text-xs font-bold text-slate-600" data-id="${item.id}">+</button>
            </div>

            <!-- Remove Button -->
            <button class="remove-cart-item text-slate-400 hover:text-red-500 p-1" data-id="${item.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `).join('')}
      </div>

      <!-- Order Summary Card -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-3 h-fit">
        <h3 class="font-bold text-slate-800 text-sm pb-2 border-b border-slate-100">অর্ডার সামারি</h3>
        
        <!-- Coupon Form -->
        <div class="flex gap-2">
          <input type="text" id="coupon-code-input" placeholder="কুপন কোড" class="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 uppercase font-semibold" />
          <button id="apply-coupon-btn" class="px-3 py-1.5 bg-slate-800 text-white font-semibold text-xs rounded-lg hover:bg-slate-900">প্রয়োগ</button>
        </div>

        <div class="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
          <div class="flex justify-between">
            <span>প্রোডাক্ট সাবটোটাল</span>
            <span class="font-semibold text-slate-800">${formatPrice(subtotal)}</span>
          </div>
          <div class="flex justify-between">
            <span>মোট ডেলিভারি চার্জ (পণ্যভিত্তিক)</span>
            <span class="font-semibold text-slate-800">${formatPrice(deliveryTotal)}</span>
          </div>
          ${discount > 0 ? `
            <div class="flex justify-between text-emerald-600 font-semibold">
              <span>কুপন ডিসকাউন্ট</span>
              <span>-${formatPrice(discount)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between text-sm font-bold text-teal-800 pt-2 border-t border-slate-200">
            <span>সর্বমোট</span>
            <span>${formatPrice(grandTotal)}</span>
          </div>
        </div>

        <button id="proceed-checkout-btn" class="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg text-sm transition">চেকআউট করুন</button>
      </div>
    </div>
  `;

  // Attach events
  container.querySelectorAll('.qty-btn-minus').forEach(b => {
    b.addEventListener('click', () => {
      const item = cart.find(i => i.id === b.dataset.id);
      if (item) {
        updateCartQuantity(item.id, item.qty - 1);
        renderCartView(container);
      }
    });
  });

  container.querySelectorAll('.qty-btn-plus').forEach(b => {
    b.addEventListener('click', () => {
      const item = cart.find(i => i.id === b.dataset.id);
      if (item) {
        updateCartQuantity(item.id, item.qty + 1);
        renderCartView(container);
      }
    });
  });

  container.querySelectorAll('.remove-cart-item').forEach(b => {
    b.addEventListener('click', () => {
      removeFromCart(b.dataset.id);
      renderCartView(container);
    });
  });

  container.querySelector('#apply-coupon-btn').addEventListener('click', async () => {
    const code = container.querySelector('#coupon-code-input').value;
    const ok = await applyCouponCode(code);
    if (ok) renderCartView(container);
  });

  container.querySelector('#proceed-checkout-btn').addEventListener('click', () => {
    renderView('checkout');
  });
}

// Checkout View
function renderCheckoutView(container) {
  const profile = getUserProfile();
  const subtotal = getSubtotal();
  const deliveryTotal = getTotalDeliveryCharge();
  const discount = getCouponDiscount();
  const grandTotal = getGrandTotal();
  const appliedCoupon = getAppliedCoupon();

  container.innerHTML = `
    <h2 class="font-bold text-slate-900 text-lg mb-4">অর্ডার চেকআউট</h2>

    <form id="checkout-form" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Shipping Info -->
      <div class="lg:col-span-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
        <h3 class="font-bold text-slate-800 text-sm border-b pb-2 border-slate-100">শিপিং তথ্য</h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">পূর্ণ নাম *</label>
            <input type="text" id="ship-name" required value="${escapeHtml(profile?.fullName || '')}" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">মোবাইল নম্বর *</label>
            <input type="tel" id="ship-phone" required value="${escapeHtml(profile?.phone || '')}" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">বিভাগ *</label>
            <input type="text" id="ship-division" required placeholder="ঢাকা" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">জেলা *</label>
            <input type="text" id="ship-district" required placeholder="ঢাকা" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">উপজেলা/থানা *</label>
            <input type="text" id="ship-upazila" required placeholder="ধানমন্ডি" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">এলাকা/গ্রাম *</label>
            <input type="text" id="ship-area" required placeholder="যেমন: ধানমন্ডি ১৫" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">বিস্তারিত ঠিকানা *</label>
          <textarea id="ship-address" required rows="2" placeholder="বাসা/রোড নম্বর, এলাকা..." class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">ডেলিভারি নোট (ঐচ্ছিক)</label>
          <input type="text" id="ship-note" placeholder="যেমন: বিকালে ডেলিভারি দিন" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
        </div>

        <!-- Payment Method Selection -->
        <div class="pt-4 border-t border-slate-100">
          <h3 class="font-bold text-slate-800 text-sm mb-3">পেমেন্ট মেথড নির্বাচন করুন</h3>
          
          <div class="grid grid-cols-3 gap-2">
            <label class="border-2 border-teal-600 rounded-xl p-3 flex flex-col items-center cursor-pointer bg-teal-50/50 payment-option">
              <input type="radio" name="payment_method" value="COD" checked class="hidden" />
              <span class="text-xs font-bold text-slate-800">ক্যাশ অন ডেলিভারি</span>
            </label>
            <label class="border-2 border-slate-200 rounded-xl p-3 flex flex-col items-center cursor-pointer hover:border-pink-500 payment-option">
              <input type="radio" name="payment_method" value="bkash" class="hidden" />
              <span class="text-xs font-bold text-pink-600">bKash</span>
            </label>
            <label class="border-2 border-slate-200 rounded-xl p-3 flex flex-col items-center cursor-pointer hover:border-orange-500 payment-option">
              <input type="radio" name="payment_method" value="nagad" class="hidden" />
              <span class="text-xs font-bold text-orange-600">Nagad</span>
            </label>
          </div>

          <!-- MFS TrxId Input (shown if bkash or nagad selected) -->
          <div id="mfs-trx-container" class="hidden mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <p class="text-xs text-slate-600">আমাদের মার্চেন্ট নম্বর <span class="font-bold text-teal-700">01700000000</span> এ সেন্ড মানি করে TrxID নিচে লিখুন:</p>
            <input type="text" id="payment-trxid" placeholder="Transaction ID (TrxID)" class="w-full text-xs p-2 border border-slate-300 rounded-lg uppercase" />
          </div>
        </div>
      </div>

      <!-- Final Summary Column -->
      <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-4 h-fit">
        <h3 class="font-bold text-slate-800 text-sm border-b pb-2 border-slate-100">পেমেন্ট হিসাব</h3>
        
        <!-- Coupon Form Section -->
        <div class="space-y-1.5 pb-2 border-b border-slate-100">
          <label class="block text-xs font-semibold text-slate-700">কুপন কোড (Coupon Code)</label>
          ${appliedCoupon ? `
            <div class="flex items-center justify-between bg-teal-50/40 p-2 rounded-lg border border-teal-200">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-teal-800">${escapeHtml(appliedCoupon.code)}</span>
                <span class="text-[10px] text-teal-600 font-semibold">${appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% ছাড়` : `${formatPrice(appliedCoupon.value)} ছাড়`}</span>
              </div>
              <button type="button" id="remove-checkout-coupon-btn" class="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 bg-red-50 rounded-md transition">মুছুন</button>
            </div>
          ` : `
            <div class="flex gap-2">
              <input type="text" id="checkout-coupon-input" placeholder="কুপন কোড" class="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <button type="button" id="apply-checkout-coupon-btn" class="px-3 py-1.5 bg-slate-800 text-white font-semibold text-xs rounded-lg hover:bg-slate-900 transition">প্রয়োগ</button>
            </div>
          `}
        </div>

        <div class="space-y-1.5 text-xs text-slate-600">
          <div class="flex justify-between">
            <span>প্রোডাক্ট সাবটোটাল</span>
            <span>${formatPrice(subtotal)}</span>
          </div>
          <div class="flex justify-between">
            <span>পণ্যভিত্তিক ডেলিভারি ফি</span>
            <span>${formatPrice(deliveryTotal)}</span>
          </div>
          ${discount > 0 ? `<div class="flex justify-between text-emerald-600 font-semibold"><span>কুপন ছাড়</span><span>-${formatPrice(discount)}</span></div>` : ''}
          <div class="flex justify-between text-sm font-extrabold text-teal-800 pt-2 border-t border-slate-200">
            <span>সর্বমোট দেয় টাকা</span>
            <span>${formatPrice(grandTotal)}</span>
          </div>
        </div>

        <button type="submit" class="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm transition shadow-md">অর্ডার কনফার্ম করুন</button>
      </div>
    </form>
  `;

  // Apply checkout coupon button event
  const applyCouponBtn = container.querySelector('#apply-checkout-coupon-btn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', async () => {
      const codeInput = container.querySelector('#checkout-coupon-input');
      const code = codeInput ? codeInput.value : '';
      const ok = await applyCouponCode(code);
      if (ok) {
        renderCheckoutView(container);
      }
    });
  }

  // Remove checkout coupon button event
  const removeCouponBtn = container.querySelector('#remove-checkout-coupon-btn');
  if (removeCouponBtn) {
    removeCouponBtn.addEventListener('click', () => {
      removeCoupon();
      renderCheckoutView(container);
    });
  }

  // Payment radio option highlight
  container.querySelectorAll('input[name="payment_method"]').forEach(radio => {
    radio.addEventListener('change', () => {
      container.querySelectorAll('.payment-option').forEach(l => l.classList.replace('border-teal-600', 'border-slate-200'));
      radio.closest('.payment-option').classList.replace('border-slate-200', 'border-teal-600');
      
      const mfsContainer = container.querySelector('#mfs-trx-container');
      if (radio.value === 'bkash' || radio.value === 'nagad') {
        mfsContainer.classList.remove('hidden');
      } else {
        mfsContainer.classList.add('hidden');
      }
    });
  });

  // Submit order
  container.querySelector('#checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payMethod = container.querySelector('input[name="payment_method"]:checked').value;
    const trxId = container.querySelector('#payment-trxid')?.value || '';

    if ((payMethod === 'bkash' || payMethod === 'nagad') && !trxId.trim()) {
      showToast('Transaction ID (TrxID) লিখুন', 'error');
      return;
    }

    const orderPayload = {
      fullName: container.querySelector('#ship-name').value,
      phone: container.querySelector('#ship-phone').value,
      division: container.querySelector('#ship-division').value,
      district: container.querySelector('#ship-district').value,
      upazila: container.querySelector('#ship-upazila').value,
      area: container.querySelector('#ship-area').value,
      address: container.querySelector('#ship-address').value,
      note: container.querySelector('#ship-note').value,
      paymentMethod: payMethod,
      trxId: trxId
    };

    const res = await placeOrder(orderPayload);
    if (res) {
      renderOrderSuccessView(container, res);
    }
  });
}

// Order Success Screen
function renderOrderSuccessView(container, orderDoc) {
  container.innerHTML = `
    <div class="max-w-md mx-auto bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-4 my-8">
      <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
      </div>

      <div>
        <h2 class="text-lg font-bold text-slate-900">অর্ডার সফলভাবে জমা হয়েছে!</h2>
        <p class="text-xs text-slate-500 mt-1">আপনার অর্ডার নম্বর: <span class="font-bold text-teal-700">${escapeHtml(orderDoc.orderNumber)}</span></p>
      </div>

      <div class="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 text-left space-y-1">
        <div class="flex justify-between"><span>সর্বমোট মূল্য:</span><span class="font-bold">${formatPrice(orderDoc.grandTotal)}</span></div>
        <div class="flex justify-between"><span>পেমেন্ট মাধ্যম:</span><span class="font-semibold uppercase">${escapeHtml(orderDoc.paymentMethod)}</span></div>
      </div>

      <button id="success-continue-btn" class="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg text-xs">আরও কেনাকাটা করুন</button>
    </div>
  `;

  container.querySelector('#success-continue-btn').addEventListener('click', () => renderView('home'));
}

// Chat View
function renderChatView(container) {
  container.innerHTML = `
    <div class="chat-container">
      <div class="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h3 class="font-bold text-slate-800 text-xs sm:text-sm">বাংলামার্ট লাইভ সাপোর্ট</h3>
        </div>
      </div>

      <div id="chat-messages-box" class="flex-1 p-3 overflow-y-auto"></div>

      <form id="chat-send-form" class="p-2 border-t border-slate-200 flex items-center gap-2 bg-white">
        <input type="text" id="chat-msg-input" placeholder="আপনার মেসেজ লিখুন..." class="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none" />
        <button type="submit" class="p-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
        </button>
      </form>
    </div>
  `;

  const box = container.querySelector('#chat-messages-box');
  initLiveChat(box);

  container.querySelector('#chat-send-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = container.querySelector('#chat-msg-input');
    const txt = input.value;
    if (txt) {
      sendChatMessage(txt);
      input.value = '';
    }
  });
}

// Profile & Orders View
async function renderProfileView(container) {
  const user = getCurrentUser();
  const profile = getUserProfile();

  if (!user) {
    container.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-slate-200 p-6">
        <h3 class="font-bold text-slate-800 text-base mb-2">প্রোফাইল দেখতে লগইন করুন</h3>
        <button id="prof-login-trigger" class="px-5 py-2.5 bg-teal-700 text-white font-bold rounded-lg text-xs">লগইন করুন</button>
      </div>
    `;
    container.querySelector('#prof-login-trigger')?.addEventListener('click', () => {
      document.getElementById('auth-modal')?.classList.remove('hidden');
    });
    return;
  }

  container.innerHTML = `
    <div class="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
      <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-700 text-white font-bold text-base sm:text-lg flex items-center justify-center">
          ${(profile?.fullName || 'G')[0].toUpperCase()}
        </div>
        <div>
          <h3 class="font-bold text-slate-900 text-sm sm:text-base">${escapeHtml(profile?.fullName || 'গ্রাহক')}</h3>
          <p class="text-2xs sm:text-xs text-slate-500">${escapeHtml(user.email)}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <!-- LEFT column: Order History -->
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col">
          <h4 class="font-bold text-slate-800 text-xs sm:text-sm mb-2 pb-1 border-b border-slate-200">অর্ডার হিস্ট্রি</h4>
          <div id="profile-orders-list" class="flex-1 max-h-80 overflow-y-auto space-y-2 pr-1 text-xs text-slate-600">
            লোড হচ্ছে...
          </div>
        </div>

        <!-- RIGHT column: Info & Address -->
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col">
          <h4 class="font-bold text-slate-800 text-xs sm:text-sm mb-2 pb-1 border-b border-slate-200">তথ্য ও ঠিকানা</h4>
          <form id="address-update-form" class="space-y-2.5 flex-1 max-h-80 overflow-y-auto pr-1">
            <div>
              <label class="block text-2xs sm:text-xs text-slate-600 mb-1">ফোন নম্বর</label>
              <input type="tel" id="prof-phone" value="${escapeHtml(profile?.phone || '')}" class="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white" />
            </div>
            <div>
              <label class="block text-2xs sm:text-xs text-slate-600 mb-1">ঠিকানা</label>
              <textarea id="prof-addr" class="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white" rows="3">${escapeHtml(profile?.defaultAddress?.address || '')}</textarea>
            </div>
            <button type="submit" class="w-full py-2 bg-slate-800 text-white font-semibold text-xs rounded-lg hover:bg-slate-900 transition">সেভ করুন</button>
          </form>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#address-update-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = container.querySelector('#prof-phone').value;
    const addr = container.querySelector('#prof-addr').value;
    await updateUserAddress({ phone, address: addr });
  });

  // Load orders into LEFT column
  const ordersBox = container.querySelector('#profile-orders-list');
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    const orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));

    if (orders.length === 0) {
      ordersBox.innerHTML = `<p class="text-xs text-slate-400 py-6 text-center">আপনি এখনো কোনো অর্ডার করেননি</p>`;
      return;
    }

    ordersBox.innerHTML = orders.map(o => `
      <div class="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1 shadow-2xs">
        <div class="flex justify-between font-bold text-slate-800">
          <span>#${escapeHtml(o.orderNumber || o.id.slice(0,6))}</span>
          <span class="text-teal-700">${escapeHtml(o.orderStatus || 'Pending')}</span>
        </div>
        <div class="flex justify-between text-slate-500 text-2xs sm:text-xs">
          <span>মূল্য: ${formatPrice(o.grandTotal)}</span>
          <span>পেমেন্ট: ${escapeHtml(o.paymentStatus || o.paymentMethod)}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading orders:', err);
    ordersBox.innerHTML = `<p class="text-xs text-red-400">অর্ডার লোড করতে সমস্যা হয়েছে</p>`;
  }
}

async function renderStaticInfoView(type) {
  const main = document.getElementById('app-content');
  if (!main) return;

  const titles = {
    settings: 'সেটিংস',
    help: 'হেল্প সেন্টার',
    contact: 'যোগাযোগ',
    about: 'আমাদের সম্পর্কে'
  };

  const fieldMap = {
    help: 'helpCenterContent',
    contact: 'contactUsContent',
    about: 'aboutContent'
  };

  main.innerHTML = `
    <div class="bg-white rounded-2xl p-6 border border-slate-200 max-w-2xl mx-auto space-y-4 shadow-2xs">
      <h2 class="font-bold text-slate-900 text-lg">${titles[type] || 'তথ্য'}</h2>
      <div id="static-content-body" class="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
        লোড হচ্ছে...
      </div>
      <button id="back-home-btn" class="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs rounded-lg transition">হোমে ফিরে যান</button>
    </div>
  `;

  main.querySelector('#back-home-btn').addEventListener('click', () => renderView('home'));

  const contentBox = main.querySelector('#static-content-body');
  if (fieldMap[type]) {
    try {
      const docRef = doc(db, 'settings', 'pageContents');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const val = docSnap.data()[fieldMap[type]];
        if (val && val.trim().length > 0) {
          contentBox.textContent = val;
        } else {
          contentBox.textContent = 'এই পেজের তথ্য শীঘ্রই যুক্ত করা হবে';
        }
      } else {
        contentBox.textContent = 'এই পেজের তথ্য শীঘ্রই যুক্ত করা হবে';
      }
    } catch (err) {
      console.error('Error fetching static content:', err);
      contentBox.textContent = 'এই পেজের তথ্য শীঘ্রই যুক্ত করা হবে';
    }
  } else {
    contentBox.textContent = 'এই পেজের তথ্য শীঘ্রই যুক্ত করা হবে';
  }
}

// Dark Mode theme application function
export async function applyAppTheme(theme, saveToFirestore = true) {
  localStorage.setItem('theme', theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }

  if (saveToFirestore) {
    const user = getCurrentUser();
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { theme });
      } catch (err) {
        console.error('Error saving theme to Firestore:', err);
      }
    }
  }
}

// Settings View Renderer
export function renderSettingsView(container) {
  if (!container) return;

  const currentTheme = localStorage.getItem('theme') || 'light';
  const isDark = currentTheme === 'dark';

  container.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="pb-3 border-b border-slate-200">
        <h2 class="font-bold text-slate-900 text-lg sm:text-xl">সেটিংস (Settings)</h2>
        <p class="text-xs text-slate-500 mt-1">আপনার একাউন্ট ও অ্যাপ্লিকেশনের সেটিংস পরিবর্তন করুন</p>
      </div>

      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-6">
        <!-- Theme Setting -->
        <div class="flex items-center justify-between">
          <div class="space-y-1 pr-4">
            <h3 class="font-bold text-slate-800 text-sm sm:text-base">ডার্ক মোড (Dark Mode)</h3>
            <p class="text-xs text-slate-500">অ্যাপটিকে ডার্ক থিমে ব্যবহার করতে ডার্ক মোড অন করুন। এটি আপনার চোখের আরামের জন্য চমৎকার।</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0">
            <input type="checkbox" id="dark-mode-toggle" class="sr-only peer" ${isDark ? 'checked' : ''}>
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>
      </div>

      <div class="flex justify-end">
        <button id="settings-back-home-btn" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition">হোমে ফিরে যান</button>
      </div>
    </div>
  `;

  // Attach Dark Mode Toggle Change Event
  const darkModeToggle = container.querySelector('#dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', async (e) => {
      const checked = e.target.checked;
      const newTheme = checked ? 'dark' : 'light';
      await applyAppTheme(newTheme);
      showToast(newTheme === 'dark' ? 'ডার্ক মোড সক্রিয় করা হয়েছে' : 'লাইট মোড সক্রিয় করা হয়েছে', 'success');
    });
  }

  container.querySelector('#settings-back-home-btn')?.addEventListener('click', () => {
    renderView('home');
  });
}
