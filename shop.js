// Product Catalog, Category Pagination ("আরও"), and Search Engine
import { 
  db, 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  addDoc, 
  serverTimestamp 
} from "./firebase-config.js";
import { formatPrice, escapeHtml, getImageUrl, showToast } from "./core.js";
import { addToCart } from "./cart-checkout.js";
import { toggleWishlist, isInWishlist } from "./app.js";

// State tracking per category grid for "আরও" (Load More) pagination
const categoryState = {};

// Default Fallback Products (Only used if Firestore database is empty)
const DEFAULT_PRODUCTS = [
  {
    id: "prod-1",
    title: "প্রিমিয়াম কটোন পাঞ্জাবি - রয়েল ব্লু",
    category: "panjabi",
    brand: "আপন ফ্যাশন",
    sku: "PF-101",
    price: 1850,
    discountPrice: 1450,
    deliveryCharge: 60,
    stock: 25,
    rating: 4.8,
    badge: "হট ডিল",
    images: ["https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=500&q=80"],
    specifications: { "ফেব্রিক": "১০০% প্রিমিয়াম সুতি", "সাইজ": "M, L, XL, XXL", "মেড ইন": "বাংলাদেশ" },
    description: "আরামদায়ক কাপড়ে তৈরি আভিজাত্যপূর্ণ ডিজাইনের পাঞ্জাবি। ঈদ এবং যেকোনো উৎসবের জন্য সেরা পছন্দ।"
  },
  {
    id: "prod-2",
    title: "স্মার্ট ওয়াচ প্রো টি-৯০০ আল্ট্রা",
    category: "electronics",
    brand: "স্মার্টটেক",
    sku: "ST-900",
    price: 2200,
    discountPrice: 1650,
    deliveryCharge: 80,
    stock: 12,
    rating: 4.6,
    badge: "অফার",
    images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80"],
    specifications: { "ডিসপ্লে": "২.০১ ইঞ্চি HD", "ব্যাটারি": "৩৮০ mAh", "ওয়ারেন্টি": "৬ মাস" },
    description: "ব্লুটুথ কলিং, হার্ট রেট ও স্লিপ মনিটরিং সমৃদ্ধ আধুনিক আল্ট্রা স্মার্টওয়াচ।"
  },
  {
    id: "prod-3",
    title: "অর্গানিক সরিষার তেল - ১ লিটার",
    category: "groceries",
    brand: "আপন ফুড",
    sku: "AF-OIL-1",
    price: 360,
    discountPrice: 320,
    deliveryCharge: 50,
    stock: 50,
    rating: 4.9,
    badge: "অর্গানিক",
    images: ["https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80"],
    specifications: { "ওজন": "১ লিটার", "উৎপাদন": "কাঠের ঘানি ভাঙা" },
    description: "শতভাগ খাঁটি কাঠের ঘানিতে ভাঙা খাঁটি সরিষার তেল।"
  },
  {
    id: "prod-4",
    title: "লেদার ওয়ালেট ও বেল্ট কম্বো সেট",
    category: "fashion",
    brand: "রয়েল লেদার",
    sku: "RL-COMBO",
    price: 1950,
    discountPrice: 1390,
    deliveryCharge: 60,
    stock: 18,
    rating: 4.7,
    badge: "কম্বো",
    images: ["https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&q=80"],
    specifications: { "উপাদান": "১০০% খাঁটি চামড়া", "রং": "চকলেট ব্রাউন" },
    description: "প্রাকৃতিক আসল চামড়ায় তৈরি ওয়ালেট ও এডজাস্টেবল বেল্ট কম্বো সেট।"
  },
  {
    id: "prod-5",
    title: "ওয়্যারলেস নয়েজ ক্যানসেলিং হেডফোন",
    category: "electronics",
    brand: "সাউন্ডপ্রো",
    sku: "SP-HEAD-2",
    price: 3500,
    discountPrice: 2800,
    deliveryCharge: 70,
    stock: 8,
    rating: 4.9,
    badge: "সেরা সেলার",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80"],
    specifications: { "প্লেটাইম": "৪০ ঘণ্টা", "কানেক্টিভিটি": "ব্লুটুথ ৫.৩" },
    description: "ডিপ বেস ও অ্যাক্টিভ নয়েজ ক্যানসেলেশন সহ দীর্ঘ ব্যাটারি লাইফের প্রিমিয়াম হেডফোন।"
  }
];

// Default Empty Categories Export
export const DEFAULT_CATEGORIES = [];

// Fetch Products For a Category with 2-Row (4 Products) Initial Batch
export async function fetchCategoryProducts(categoryId, isLoadMore = false) {
  if (!db) return { products: [], lastVisibleDoc: null, hasMore: false };

  const state = categoryState[categoryId] || {
    products: [],
    lastVisibleDoc: null,
    hasMore: true
  };

  if (!isLoadMore) {
    state.products = [];
    state.lastVisibleDoc = null;
    state.hasMore = true;
  }

  if (!state.hasMore && isLoadMore) return state;

  try {
    let q;
    const batchLimit = 4; // Exactly 2 rows on mobile (2 cols x 2 rows = 4 products)

    if (categoryId === "all") {
      if (state.lastVisibleDoc) {
        q = query(collection(db, "products"), orderBy("createdAt", "desc"), startAfter(state.lastVisibleDoc), limit(batchLimit));
      } else {
        q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(batchLimit));
      }
    } else {
      if (state.lastVisibleDoc) {
        q = query(collection(db, "products"), where("category", "==", categoryId), startAfter(state.lastVisibleDoc), limit(batchLimit));
      } else {
        q = query(collection(db, "products"), where("category", "==", categoryId), limit(batchLimit));
      }
    }

    const snapshot = await getDocs(q);
    
    if (snapshot.empty && !isLoadMore) {
      state.products = [];
      state.hasMore = false;
    } else {
      const newItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      state.products = [...state.products, ...newItems];
      state.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      state.hasMore = snapshot.docs.length === batchLimit;
    }

    categoryState[categoryId] = state;
    return state;
  } catch (err) {
    console.warn("Firestore products fetch failed:", err);
    state.products = [];
    state.hasMore = false;
    categoryState[categoryId] = state;
    return state;
  }
}

// Render Product Card Component
export function renderProductCard(product) {
  const isWished = isInWishlist(product.id);
  const deliveryText = product.deliveryCharge === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ${formatPrice(product.deliveryCharge)}`;

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-image-wrap cursor-pointer" onclick="window.viewProductDetail('${product.id}')">
        <img src="${getImageUrl(product.images?.[0])}" alt="${escapeHtml(product.title)}" loading="lazy">
        ${product.badge ? `<span class="badge-discount">${escapeHtml(product.badge)}</span>` : ''}
        
        <!-- Wishlist Button -->
        <button 
          onclick="event.stopPropagation(); window.toggleWishlistClick('${product.id}')"
          class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-slate-600 active:scale-95 transition-all"
        >
          <svg class="w-4 h-4 ${isWished ? 'fill-red-500 text-red-500' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>
      </div>

      <div class="product-details">
        <h3 class="product-title cursor-pointer" onclick="window.viewProductDetail('${product.id}')">
          ${escapeHtml(product.title)}
        </h3>

        <div class="flex items-center gap-1 text-amber-500 text-xs mb-1">
          <span>★</span>
          <span class="font-bold text-slate-700">${product.rating || 4.8}</span>
          <span class="text-slate-400 text-[10px]">(${product.brand || 'আপন'})</span>
        </div>

        <div class="product-price-row">
          <span class="current-price">${formatPrice(product.discountPrice || product.price)}</span>
          ${product.discountPrice ? `<span class="original-price">${formatPrice(product.price)}</span>` : ''}
        </div>

        <!-- Per-Product Delivery Charge Badge (Mandatory Display) -->
        <span class="delivery-tag">${deliveryText}</span>

        <!-- Quick Add to Cart Button -->
        <button 
          onclick="event.stopPropagation(); window.quickAddToCart('${product.id}')"
          class="mt-2.5 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>কার্টে যোগ করুন</span>
        </button>
      </div>
    </div>
  `;
}

// Render Home Page Category Sections with Dynamic Banners and Categories from Firestore
export async function renderHomeCategorySections(containerEl) {
  containerEl.innerHTML = `
    <div class="py-12 text-center text-slate-400 text-xs">
      ডাটা লোড হচ্ছে...
    </div>
  `;

  let banners = [];
  let categories = [];

  if (db) {
    try {
      const [bannerSnap, catSnap] = await Promise.all([
        getDocs(query(collection(db, "banners"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "categories"), orderBy("createdAt", "desc")))
      ]);

      if (!bannerSnap.empty) {
        banners = bannerSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      if (!catSnap.empty) {
        categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Failed to load home sections from Firestore:", e);
    }
  }

  let html = ``;

  // 1. Hero Slider Banner (Only if added by admin)
  if (banners.length > 0) {
    html += `
      <div class="hero-slider mb-4 relative overflow-hidden rounded-2xl bg-slate-100">
        <div class="hero-slides-wrapper flex transition-transform duration-500 ease-out" id="hero-slider-track">
          ${banners.map(b => `
            <div class="w-full shrink-0 relative aspect-[21/9]">
              <a href="${escapeHtml(b.link || '#')}">
                <img src="${getImageUrl(b.imageUrl)}" alt="${escapeHtml(b.title || 'Banner')}" class="w-full h-full object-cover">
                ${b.title ? `<div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3 text-white text-xs font-bold">${escapeHtml(b.title)}</div>` : ''}
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 2. Category Pill Fast Selector (Only if added by admin)
  if (categories.length > 0) {
    html += `
      <div class="mb-5">
        <h2 class="text-sm font-bold text-slate-800 mb-2.5 px-1">জনপ্রিয় ক্যাটাগরি</h2>
        <div class="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          ${categories.map(cat => `
            <a href="#category-${cat.slug || cat.id}" class="category-pill shrink-0 flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl">
              <div class="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                <img src="${getImageUrl(cat.imageUrl)}" class="w-full h-full object-cover" alt="${escapeHtml(cat.name)}">
              </div>
              <span class="text-[11px] font-semibold text-slate-700 whitespace-nowrap pr-1">${escapeHtml(cat.name)}</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 3. Category Sections Container
  if (categories.length === 0 && banners.length === 0) {
    html += `
      <div class="bg-white border border-slate-200 rounded-2xl p-8 text-center my-6 space-y-3 max-w-md mx-auto">
        <div class="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
        </div>
        <h3 class="text-sm font-bold text-slate-900">কোনো তথ্য যুক্ত করা হয়নি</h3>
        <p class="text-xs text-slate-500">এডমিন প্যানেল থেকে স্লাইডার ব্যানার ও ক্যাটাগরি যুক্ত করলে এখানে লাইভ দেখা যাবে।</p>
      </div>
    `;
  } else {
    html += `<div id="category-sections-wrapper" class="space-y-6"></div>`;
  }

  containerEl.innerHTML = html;

  // Initialize slider auto-advance if multiple banners
  if (banners.length > 1) {
    let currentSlide = 0;
    const track = document.getElementById("hero-slider-track");
    if (track) {
      setInterval(() => {
        currentSlide = (currentSlide + 1) % banners.length;
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
      }, 4000);
    }
  }

  // Render products per category
  const sectionsWrapper = document.getElementById("category-sections-wrapper");
  if (!sectionsWrapper || categories.length === 0) return;

  for (const cat of categories) {
    const catId = cat.slug || cat.id;
    const section = document.createElement("section");
    section.className = "category-block";
    section.id = `section-cat-${catId}`;

    section.innerHTML = `
      <div class="flex items-center justify-between mb-3 px-1">
        <h2 class="text-base font-bold text-slate-900 border-l-4 border-emerald-600 pl-2">
          ${escapeHtml(cat.name)}
        </h2>
      </div>

      <div class="category-product-grid" id="grid-cat-${catId}">
        ${[1, 2, 3, 4].map(() => `<div class="product-card h-64 skeleton"></div>`).join('')}
      </div>

      <div class="flex justify-end mt-2" id="more-container-${catId}"></div>
    `;

    sectionsWrapper.appendChild(section);

    const state = await fetchCategoryProducts(catId, false);
    const gridEl = document.getElementById(`grid-cat-${catId}`);
    const moreEl = document.getElementById(`more-container-${catId}`);

    if (state.products.length === 0) {
      gridEl.innerHTML = `<div class="col-span-2 py-6 text-center text-xs text-slate-400 bg-white border border-slate-100 rounded-xl">এই ক্যাটাগরিতে এখনো কোনো পণ্য যুক্ত করা হয়নি</div>`;
    } else {
      gridEl.innerHTML = state.products.map(p => renderProductCard(p)).join('');
    }

    if (state.hasMore) {
      moreEl.innerHTML = `
        <button class="load-more-link" onclick="window.expandCategoryGrid('${catId}')">
          <span>আরও</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
      `;
    }
  }
}

// Handle "আরও" Expansion per Category in Place
window.expandCategoryGrid = async function(categoryId) {
  const moreContainer = document.getElementById(`more-container-${categoryId}`);
  if (moreContainer) {
    moreContainer.innerHTML = `<span class="text-xs text-slate-400 p-2">লোড হচ্ছে...</span>`;
  }

  const state = await fetchCategoryProducts(categoryId, true);
  const gridEl = document.getElementById(`grid-cat-${categoryId}`);

  if (gridEl) {
    gridEl.innerHTML = state.products.map(p => renderProductCard(p)).join('');
  }

  if (moreContainer) {
    if (state.hasMore) {
      moreContainer.innerHTML = `
        <button class="load-more-link" onclick="window.expandCategoryGrid('${categoryId}')">
          <span>আরও</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
      `;
    } else {
      moreContainer.innerHTML = ``; // Hide when all products are loaded
    }
  }
};

// Open Product Detail Modal
window.viewProductDetail = async function(productId) {
  let product = DEFAULT_PRODUCTS.find(p => p.id === productId);

  if (!product && db) {
    try {
      const docSnap = await getDoc(doc(db, "products", productId));
      if (docSnap.exists()) product = { id: docSnap.id, ...docSnap.data() };
    } catch (e) {
      console.warn("Error fetching product detail:", e);
    }
  }

  if (!product) {
    showToast("পণ্য খুঁজে পাওয়া যায়নি", "error");
    return;
  }

  const mount = document.getElementById("product-modal-mount");
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) window.closeProductModal()">
      <div class="modal-content p-4">
        
        <!-- Close Button -->
        <button onclick="window.closeProductModal()" class="absolute top-3 right-3 p-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 min-h-[44px]">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Product Image Showcase -->
        <div class="w-full aspect-square bg-slate-100 rounded-xl overflow-hidden mb-4 relative">
          <img id="detail-main-img" src="${getImageUrl(product.images?.[0])}" class="w-full h-full object-cover transition-transform duration-300">
        </div>

        <!-- Product Info -->
        <div class="mb-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">${escapeHtml(product.brand || 'আপন')}</span>
            <span class="text-xs text-slate-400">SKU: ${escapeHtml(product.sku || 'N/A')}</span>
          </div>
          
          <h2 class="text-lg font-bold text-slate-900 mb-2">${escapeHtml(product.title)}</h2>

          <div class="flex items-baseline gap-3 mb-3">
            <span class="text-xl font-bold text-emerald-700">${formatPrice(product.discountPrice || product.price)}</span>
            ${product.discountPrice ? `<span class="text-sm text-slate-400 line-through">${formatPrice(product.price)}</span>` : ''}
          </div>

          <!-- Mandatory Delivery Charge Display -->
          <div class="bg-blue-50 border border-blue-100 p-2.5 rounded-lg text-xs text-blue-900 flex items-center justify-between mb-3">
            <span>ডেলিভারি চার্জ (প্রতিটি পণ্য):</span>
            <span class="font-bold text-blue-700">${product.deliveryCharge === 0 ? 'ফ্রি ডেলিভারি' : formatPrice(product.deliveryCharge)}</span>
          </div>

          <p class="text-xs text-slate-600 leading-relaxed mb-4">${escapeHtml(product.description)}</p>

          <!-- Specifications Table -->
          ${product.specifications ? `
            <div class="border-t border-slate-200 pt-3 mb-4">
              <h4 class="text-xs font-bold text-slate-800 mb-2">স্পেসিফিকেশন:</h4>
              <div class="grid grid-cols-2 gap-2 text-xs">
                ${Object.entries(product.specifications).map(([k, v]) => `
                  <div class="bg-slate-50 p-2 rounded"><span class="text-slate-400">${escapeHtml(k)}:</span> <span class="font-medium text-slate-800">${escapeHtml(v)}</span></div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Stock & Action Buttons -->
          <div class="flex items-center gap-3 mt-4">
            <button 
              onclick="window.quickAddToCart('${product.id}'); window.closeProductModal()"
              class="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl text-sm min-h-[44px] flex items-center justify-center gap-2"
            >
              <span>কার্টে যোগ করুন</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  `;
};

window.closeProductModal = function() {
  const mount = document.getElementById("product-modal-mount");
  if (mount) mount.innerHTML = "";
};
