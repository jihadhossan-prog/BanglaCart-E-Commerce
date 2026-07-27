import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, getDoc, query, where, orderBy, limit, startAfter, setDoc, deleteDoc } from 'firebase/firestore';
import { formatPrice, showToast, checkAndSeedInitialData, DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from './core.js';
import { addToCart } from './cart-checkout.js';

let allCategories = [];
let categoryPaginations = {}; // Tracks pagination state per category: { [catId]: { lastDoc, productsCount, hasMore } }
let wishlistProductIds = new Set();

// --- Initialize Shop ---
export async function initShop() {
  await checkAndSeedInitialData();
  await loadCategories();
  await loadWishlistIds();
  await renderCategorySections();
}

// --- Load Wishlist IDs ---
export async function loadWishlistIds() {
  wishlistProductIds.clear();
  if (!auth.currentUser) {
    const localW = JSON.parse(localStorage.getItem('wishlist') || '[]');
    localW.forEach(id => wishlistProductIds.add(id));
    updateWishlistBadge();
    return;
  }
  try {
    const q = query(collection(db, 'wishlist'), where('userId', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(d => wishlistProductIds.add(d.data().productId));
    updateWishlistBadge();
  } catch (e) {
    console.warn("Wishlist fetch fallback:", e);
  }
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlist-badge');
  if (badge) {
    if (wishlistProductIds.size > 0) {
      badge.textContent = wishlistProductIds.size;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// --- Toggle Wishlist ---
export async function toggleWishlist(productId) {
  const isWishlisted = wishlistProductIds.has(productId);
  if (isWishlisted) {
    wishlistProductIds.delete(productId);
    showToast('উইশলিস্ট থেকে সরানো হয়েছে', 'info');
  } else {
    wishlistProductIds.add(productId);
    showToast('উইশলিস্টে যোগ করা হয়েছে!', 'success');
  }
  
  localStorage.setItem('wishlist', JSON.stringify(Array.from(wishlistProductIds)));
  updateWishlistBadge();
  
  if (auth.currentUser) {
    try {
      const wishRef = doc(db, 'wishlist', `${auth.currentUser.uid}_${productId}`);
      if (!isWishlisted) {
        await setDoc(wishRef, {
          userId: auth.currentUser.uid,
          productId: productId,
          createdAt: new Date().toISOString()
        });
      } else {
        await deleteDoc(wishRef);
      }
    } catch (e) {
      console.warn("Wishlist sync err:", e);
    }
  }
  
  // Re-render button icon state if visible
  document.querySelectorAll(`.wish-btn-${productId}`).forEach(btn => {
    btn.classList.toggle('active', wishlistProductIds.has(productId));
  });
}

// --- Load Categories ---
export async function loadCategories() {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (!snap.empty) {
      allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      allCategories = DEFAULT_CATEGORIES;
    }
  } catch (e) {
    allCategories = DEFAULT_CATEGORIES;
  }
  renderCategoriesGrid();
}

function renderCategoriesGrid() {
  const container = document.getElementById('categories-grid');
  if (!container) return;
  
  container.innerHTML = allCategories.map(cat => `
    <div class="category-card" onclick="window.scrollToCategorySection('${cat.id}')">
      <div class="category-icon-wrap">
        ${cat.image ? `<img src="${cat.image}" alt="${cat.name}"/>` : `<span class="font-bold text-lg">${cat.name.charAt(0)}</span>`}
      </div>
      <span class="category-name">${cat.name}</span>
    </div>
  `).join('');
}

window.scrollToCategorySection = function(catId) {
  const elem = document.getElementById(`cat-section-${catId}`);
  if (elem) {
    elem.scrollIntoView({ behavior: 'smooth' });
  }
};

// --- Render Per-Category Product Sections ---
// Mandatory: Mobile ~360-414px 2 columns, initial 2 rows (4 products), "আরও" compact text link at bottom-right of grid.
export async function renderCategorySections() {
  const container = document.getElementById('category-sections-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  for (const cat of allCategories) {
    const section = document.createElement('div');
    section.id = `cat-section-${cat.id}`;
    section.className = 'space-y-3';
    
    section.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-200 pb-2">
        <h3 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
          <span class="w-1.5 h-4 bg-amber-500 rounded-full"></span>
          <span>${cat.name}</span>
        </h3>
      </div>
      <div id="grid-${cat.id}" class="product-grid">
        <div class="skeleton h-48 w-full"></div>
        <div class="skeleton h-48 w-full"></div>
      </div>
      <div class="flex justify-end pt-1">
        <button id="more-btn-${cat.id}" class="category-more-link hidden" onclick="window.loadMoreCategoryProducts('${cat.id}')">
          <span>আরও</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
      </div>
    `;
    
    container.appendChild(section);
    
    // Initial fetch for category: 4 products (2 rows x 2 cols on mobile)
    await loadCategoryProductsInitial(cat.id);
  }
}

async function loadCategoryProductsInitial(catId) {
  const grid = document.getElementById(`grid-${catId}`);
  const moreBtn = document.getElementById(`more-btn-${catId}`);
  if (!grid) return;

  try {
    const q = query(
      collection(db, 'products'),
      where('category', '==', catId),
      limit(5) // Fetch 5 to check if hasMore
    );
    const snap = await getDocs(q);
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (products.length === 0) {
      // Fallback filter from DEFAULT_PRODUCTS
      products = DEFAULT_PRODUCTS.filter(p => p.category === catId);
    }
    
    const hasMore = products.length > 4;
    const initialBatch = products.slice(0, 4);
    
    categoryPaginations[catId] = {
      offset: 4,
      allCatProducts: products,
      hasMore: hasMore
    };
    
    grid.innerHTML = initialBatch.map(p => renderProductCardHTML(p)).join('');
    
    if (hasMore && moreBtn) {
      moreBtn.classList.remove('hidden');
    } else if (moreBtn) {
      moreBtn.classList.add('hidden');
    }
  } catch (e) {
    console.warn("Category query fallback:", e);
    const fallbackProducts = DEFAULT_PRODUCTS.filter(p => p.category === catId);
    grid.innerHTML = fallbackProducts.slice(0, 4).map(p => renderProductCardHTML(p)).join('');
  }
}

window.loadMoreCategoryProducts = async function(catId) {
  const grid = document.getElementById(`grid-${catId}`);
  const moreBtn = document.getElementById(`more-btn-${catId}`);
  if (!grid) return;
  
  const state = categoryPaginations[catId] || { offset: 4 };
  
  try {
    const q = query(
      collection(db, 'products'),
      where('category', '==', catId)
    );
    const snap = await getDocs(q);
    let allProds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (allProds.length === 0) allProds = DEFAULT_PRODUCTS.filter(p => p.category === catId);
    
    const nextOffset = state.offset + 4;
    const batch = allProds.slice(state.offset, nextOffset);
    
    batch.forEach(p => {
      grid.insertAdjacentHTML('beforeend', renderProductCardHTML(p));
    });
    
    categoryPaginations[catId].offset = nextOffset;
    if (nextOffset >= allProds.length) {
      moreBtn.classList.add('hidden');
    }
  } catch (e) {
    moreBtn.classList.add('hidden');
  }
};

// --- Product Card Component HTML ---
export function renderProductCardHTML(product) {
  const isWish = wishlistProductIds.has(product.id);
  const delCharge = product.deliveryCharge !== undefined ? product.deliveryCharge : 60;
  const delText = delCharge === 0 ? 'ফ্রি ডেলিভারি' : `ডেলিভারি চার্জ: ৳${delCharge}`;

  return `
    <div class="product-card">
      <div class="product-card-image-wrap" onclick="window.viewProductDetails('${product.id}')">
        <img src="${product.images && product.images[0] ? product.images[0] : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'}" alt="${product.name}" loading="lazy"/>
        ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
        <button class="product-wishlist-btn wish-btn-${product.id} ${isWish ? 'active' : ''}" onclick="event.stopPropagation(); window.handleToggleWishlist('${product.id}')" aria-label="উইশলিস্ট">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </button>
      </div>
      <div class="product-card-body">
        <h4 class="product-title" onclick="window.viewProductDetails('${product.id}')">${product.name}</h4>
        <div class="product-price-row">
          <span class="product-price">${formatPrice(product.price)}</span>
          ${product.originalPrice ? `<span class="product-original-price">${formatPrice(product.originalPrice)}</span>` : ''}
        </div>
        <div class="product-delivery-tag">${delText}</div>
        <button class="w-full btn-primary text-xs py-2 mt-1 rounded-xl" onclick="window.quickAddToCart('${product.id}')">
          <span>কার্টে যোগ করুন</span>
        </button>
      </div>
    </div>
  `;
}

window.handleToggleWishlist = function(pId) {
  toggleWishlist(pId);
};

window.quickAddToCart = async function(pId) {
  let prod = null;
  try {
    const snap = await getDoc(doc(db, 'products', pId));
    if (snap.exists()) prod = { id: snap.id, ...snap.data() };
  } catch (e) {}
  if (!prod) prod = DEFAULT_PRODUCTS.find(p => p.id === pId);
  if (prod) addToCart(prod);
};

// --- View Product Details Modal/Section ---
window.viewProductDetails = async function(productId) {
  let product = null;
  try {
    const snap = await getDoc(doc(db, 'products', productId));
    if (snap.exists()) product = { id: snap.id, ...snap.data() };
  } catch (e) {}
  if (!product) product = DEFAULT_PRODUCTS.find(p => p.id === productId);
  
  if (!product) return;

  const detailCard = document.getElementById('product-detail-card');
  if (!detailCard) return;

  const mainImg = product.images && product.images[0] ? product.images[0] : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600';
  const delCharge = product.deliveryCharge !== undefined ? product.deliveryCharge : 60;

  detailCard.innerHTML = `
    <!-- Image Zoom & Gallery -->
    <div class="space-y-3">
      <div class="aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 group relative">
        <img id="main-product-img" src="${mainImg}" alt="${product.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-125 cursor-zoom-in" />
      </div>
      ${product.images && product.images.length > 1 ? `
        <div class="flex items-center gap-2 overflow-x-auto pb-1">
          ${product.images.map(img => `
            <button onclick="document.getElementById('main-product-img').src='${img}'" class="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
              <img src="${img}" class="w-full h-full object-cover"/>
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Details Column -->
    <div class="space-y-4">
      <div>
        <span class="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">${product.brand || 'BanglaCart Special'}</span>
        <h1 class="text-lg sm:text-xl font-bold text-slate-900 mt-2">${product.name}</h1>
        <p class="text-xs text-slate-500 mt-1">SKU: ${product.sku || 'N/A'} | স্টক: <span class="text-emerald-800 font-bold">${product.stock || 10} টি বাকি</span></p>
      </div>

      <div class="bg-slate-50 p-4 rounded-2xl space-y-1">
        <div class="flex items-baseline gap-3">
          <span class="text-2xl font-black text-emerald-800">${formatPrice(product.price)}</span>
          ${product.originalPrice ? `<span class="text-sm text-slate-400 line-through">${formatPrice(product.originalPrice)}</span>` : ''}
        </div>
        <p class="text-xs font-semibold text-emerald-900">ডেলিভারি চার্জ: ${delCharge === 0 ? 'ফ্রি' : formatPrice(delCharge)}</p>
      </div>

      <div>
        <h4 class="font-bold text-xs text-slate-700 uppercase tracking-wider mb-1">পণ্যের বিবরণ</h4>
        <p class="text-xs text-slate-600 leading-relaxed">${product.description || 'উচ্চমানের সেরা কোয়ালিটি প্রোডাক্ট।'}</p>
      </div>

      ${product.specifications ? `
        <div>
          <h4 class="font-bold text-xs text-slate-700 uppercase tracking-wider mb-1">স্পেসিফিকেশন</h4>
          <p class="text-xs text-slate-600">${product.specifications}</p>
        </div>
      ` : ''}

      <div class="pt-2 flex items-center gap-3">
        <button onclick="window.quickAddToCart('${product.id}')" class="flex-1 btn-outline text-sm py-3">
          <span>কার্টে যোগ করুন</span>
        </button>
        <button onclick="window.quickAddToCart('${product.id}'); location.hash='#cart'" class="flex-1 btn-primary text-sm py-3">
          <span>এখনই কিনুন</span>
        </button>
      </div>
    </div>
  `;

  // Show Product View Section
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  document.getElementById('product-view')?.classList.remove('hidden');
};

// Render Wishlist Page
export async function renderWishlistPage() {
  const grid = document.getElementById('wishlist-grid');
  if (!grid) return;
  
  if (wishlistProductIds.size === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 text-sm">আপনার উইশলিস্ট খালি আছে</div>`;
    return;
  }
  
  let products = [];
  try {
    const snap = await getDocs(collection(db, 'products'));
    products = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => wishlistProductIds.has(p.id));
  } catch (e) {}
  if (products.length === 0) {
    products = DEFAULT_PRODUCTS.filter(p => wishlistProductIds.has(p.id));
  }
  
  grid.innerHTML = products.map(p => renderProductCardHTML(p)).join('');
}
