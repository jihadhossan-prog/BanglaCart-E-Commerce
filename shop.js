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
  setDoc, 
  updateDoc,
  deleteDoc, 
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from './firebase-config.js';
import { formatPrice, showToast, escapeHtml, getValidImageUrl } from './core.js';
import { getCurrentUser } from './auth.js';

// Internal pagination cursors map: categoryId -> lastVisibleDoc
const categoryCursors = {};
const wishlistItems = new Set();

// Wishlist listener
export async function loadUserWishlist() {
  const user = getCurrentUser();
  wishlistItems.clear();
  if (!user) {
    updateWishlistBadge();
    return;
  }
  
  try {
    const wishRef = doc(db, 'wishlist', user.uid);
    const snap = await getDoc(wishRef);
    if (snap.exists()) {
      const data = snap.data();
      const itemsArr = data.products || data.items;
      if (Array.isArray(itemsArr)) {
        itemsArr.forEach(id => {
          if (id && typeof id === 'string') {
            wishlistItems.add(id);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error loading wishlist from Firestore:', err);
  }

  updateWishlistBadge();
}

export function updateWishlistBadge() {
  const badge = document.getElementById('wishlist-badge');
  if (badge) {
    const count = wishlistItems.size;
    badge.textContent = count;
    if (count > 0) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  }
}

export async function toggleWishlist(productId) {
  const user = getCurrentUser();
  if (!user) {
    showToast('উইশলিস্টে যুক্ত করতে আগে লগইন করুন', 'error');
    document.getElementById('auth-modal')?.classList.remove('hidden');
    return;
  }

  const alreadyWished = wishlistItems.has(productId);

  // Optimistic memory state update
  if (alreadyWished) {
    wishlistItems.delete(productId);
  } else {
    wishlistItems.add(productId);
  }
  updateWishlistBadge();

  // Optimistic UI update (heart icons)
  updateHeartIcons(productId, !alreadyWished);

  try {
    const wishRef = doc(db, 'wishlist', user.uid);
    if (!alreadyWished) {
      try {
        await updateDoc(wishRef, {
          products: arrayUnion(productId),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        // If document doesn't exist, create it with setDoc
        await setDoc(wishRef, {
          userId: user.uid,
          products: [productId],
          updatedAt: new Date().toISOString()
        });
      }
      showToast('উইশলিস্টে যুক্ত করা হয়েছে', 'success');
    } else {
      await updateDoc(wishRef, {
        products: arrayRemove(productId),
        updatedAt: new Date().toISOString()
      });
      showToast('উইশলিস্ট থেকে সরানো হয়েছে', 'info');
    }
  } catch (err) {
    console.error('Wishlist sync to Firestore failed:', err);
    // Revert state on failure
    if (alreadyWished) {
      wishlistItems.add(productId);
    } else {
      wishlistItems.delete(productId);
    }
    updateWishlistBadge();
    updateHeartIcons(productId, alreadyWished);
    showToast('উইশলিস্ট আপডেট ব্যর্থ হয়েছে', 'error');
  }
}

// Helper function to update heart icons on current view
function updateHeartIcons(productId, isWished) {
  document.querySelectorAll(`.wish-btn[data-id="${productId}"]`).forEach(btn => {
    if (isWished) {
      btn.classList.add('text-red-500');
      btn.classList.remove('text-slate-400');
      btn.innerHTML = `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
    } else {
      btn.classList.remove('text-red-500');
      btn.classList.add('text-slate-400');
      btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
    }
  });
}

// Render Single Product Card
export function createProductCardHTML(p) {
  const isWished = wishlistItems.has(p.id);
  const deliveryCharge = Number(p.deliveryCharge) || 0;
  const deliveryLabel = deliveryCharge === 0 ? 'ফ্রি ডেলিভারি' : `ডেলিভারি ${formatPrice(deliveryCharge)}`;
  
  const originalPrice = p.discountPrice ? Number(p.price) : null;
  const currentPrice = p.discountPrice ? Number(p.discountPrice) : Number(p.price);
  const discountPercent = originalPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

  const imageUrl = getValidImageUrl(Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : p.image);

  return `
    <div class="product-card group" data-id="${p.id}">
      ${discountPercent > 0 ? `<span class="badge-discount">-${discountPercent}% ছাড়</span>` : ''}
      <span class="badge-stock">${p.stock > 0 ? 'স্টকে আছে' : 'আউট অব স্টক'}</span>

      <!-- Product Image -->
      <div class="relative w-full aspect-square bg-slate-100 overflow-hidden cursor-pointer view-product-btn" data-id="${p.id}">
        <img src="${imageUrl}" alt="${escapeHtml(p.name)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
        
        <!-- Wishlist Button -->
        <button class="wish-btn absolute bottom-2 right-2 p-1.5 rounded-full bg-white/90 backdrop-blur-xs shadow-xs ${isWished ? 'text-red-500' : 'text-slate-400'} hover:text-red-500 transition" data-id="${p.id}" title="উইশলিস্টে যোগ করুন">
          ${isWished 
            ? `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>` 
            : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`}
        </button>
      </div>

      <!-- Info Container -->
      <div class="p-3 flex-1 flex flex-col justify-between gap-2">
        <div>
          <span class="text-[10px] font-semibold tracking-wider uppercase text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">${escapeHtml(p.category || 'সাধারণ')}</span>
          <h3 class="font-medium text-slate-800 text-xs sm:text-sm line-clamp-2 mt-1 hover:text-teal-700 cursor-pointer view-product-btn" data-id="${p.id}">${escapeHtml(p.name)}</h3>
        </div>

        <div>
          <!-- Per Product Delivery Badge -->
          <div class="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-1">
            <svg class="w-3 h-3 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            <span>${deliveryLabel}</span>
          </div>

          <div class="flex items-baseline gap-1.5">
            <span class="text-sm sm:text-base font-bold text-teal-700">${formatPrice(currentPrice)}</span>
            ${originalPrice ? `<span class="text-xs text-slate-400 line-through">${formatPrice(originalPrice)}</span>` : ''}
          </div>

          <button class="add-to-cart-btn w-full mt-2 py-1.5 bg-teal-50 hover:bg-teal-700 hover:text-white text-teal-700 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1" data-id="${p.id}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            <span>কার্টে রাখুন</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Fetch Banners for Hero Slider
export async function fetchBanners() {
  try {
    const q = query(collection(db, 'banners'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const banners = [];
    snap.forEach(d => banners.push({ id: d.id, ...d.data() }));
    return banners;
  } catch (err) {
    console.error('Error fetching banners:', err);
    return [];
  }
}

// Fetch All Categories
export async function fetchCategories() {
  try {
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    const categories = [];
    snap.forEach(d => categories.push({ id: d.id, ...d.data() }));
    return categories;
  } catch (err) {
    console.error('Error fetching categories:', err);
    return [];
  }
}

// Fetch Initial 4 products (2 rows x 2 cols on mobile) for a category
export async function fetchCategoryProducts(categoryName, limitCount = 4) {
  try {
    const colRef = collection(db, 'products');
    let q;
    if (categoryName && categoryName !== 'সব') {
      q = query(colRef, where('category', '==', categoryName), limit(limitCount));
    } else {
      q = query(colRef, limit(limitCount));
    }

    const snap = await getDocs(q);
    const products = [];
    let lastDoc = null;

    snap.forEach(d => {
      products.push({ id: d.id, ...d.data() });
      lastDoc = d;
    });

    if (categoryName) {
      categoryCursors[categoryName] = {
        lastDoc,
        hasMore: products.length === limitCount
      };
    }

    return { products, hasMore: products.length === limitCount };
  } catch (err) {
    console.error(`Error fetching products for category ${categoryName}:`, err);
    return { products: [], hasMore: false };
  }
}

// Load Next Batch for a Category in Place ("আরও" link tap)
export async function loadMoreCategoryProducts(categoryName, gridContainer, loadMoreBtn) {
  const cursorInfo = categoryCursors[categoryName];
  if (!cursorInfo || !cursorInfo.lastDoc || !cursorInfo.hasMore) return;

  try {
    loadMoreBtn.classList.add('opacity-50', 'pointer-events-none');
    loadMoreBtn.textContent = 'লোড হচ্ছে...';

    const colRef = collection(db, 'products');
    let q;
    if (categoryName && categoryName !== 'সব') {
      q = query(colRef, where('category', '==', categoryName), startAfter(cursorInfo.lastDoc), limit(4));
    } else {
      q = query(colRef, startAfter(cursorInfo.lastDoc), limit(4));
    }

    const snap = await getDocs(q);
    const newProducts = [];
    let newLastDoc = cursorInfo.lastDoc;

    snap.forEach(d => {
      newProducts.push({ id: d.id, ...d.data() });
      newLastDoc = d;
    });

    const hasMore = newProducts.length === 4;
    categoryCursors[categoryName] = { lastDoc: newLastDoc, hasMore };

    // Append new products to grid
    newProducts.forEach(p => {
      gridContainer.insertAdjacentHTML('beforeend', createProductCardHTML(p));
    });

    if (!hasMore) {
      loadMoreBtn.remove();
    } else {
      loadMoreBtn.classList.remove('opacity-50', 'pointer-events-none');
      loadMoreBtn.innerHTML = `আরও <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;
    }
  } catch (err) {
    console.error('Error loading more products:', err);
    showToast('পরবর্তী প্রোডাক্ট লোড করা সম্ভব হয়নি', 'error');
    loadMoreBtn.classList.remove('opacity-50', 'pointer-events-none');
    loadMoreBtn.textContent = 'আরও চেষ্টা করুন';
  }
}

// Fetch Single Product Details
export async function getProductById(productId) {
  if (!productId || typeof productId !== 'string') {
    return null;
  }
  try {
    const snap = await getDoc(doc(db, 'products', productId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (err) {
    console.error('Error fetching product:', err);
    return null;
  }
}

// Product Reviews
export async function fetchProductReviews(productId) {
  try {
    const q = query(collection(db, 'reviews'), where('productId', '==', productId));
    const snap = await getDocs(q);
    const reviews = [];
    snap.forEach(d => reviews.push({ id: d.id, ...d.data() }));
    return reviews;
  } catch (err) {
    console.error('Error fetching reviews:', err);
    return [];
  }
}

export async function addProductReview(productId, rating, comment) {
  const user = getCurrentUser();
  if (!user) {
    showToast('রিভিউ দিতে হলে লগইন করুন', 'error');
    return false;
  }

  try {
    await addDoc(collection(db, 'reviews'), {
      productId,
      userId: user.uid,
      userName: user.displayName || 'ক্রেতা',
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: new Date().toISOString()
    });
    showToast('ধন্যবাদ! আপনার রিভিউ জমা হয়েছে', 'success');
    return true;
  } catch (err) {
    console.error('Add review error:', err);
    showToast('রিভিউ জমা দেওয়া সম্ভব হয়নি', 'error');
    return false;
  }
}
