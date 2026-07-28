import { 
  db, 
  auth, 
  onAuthStateChanged, 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from './firebase-config.js';
import { formatPrice, showToast, escapeHtml, getValidImageUrl } from './core.js';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

let currentAdminUser = null;
let activeAdminTab = 'dashboard';

// Role-Based Access Control Verification
onAuthStateChanged(auth, async (user) => {
  const overlay = document.getElementById('admin-auth-check');
  if (!user) {
    window.location.href = './index.html';
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists() || docSnap.data().role !== 'admin') {
      alert('আপনার এডমিন হিসেবে এই পেজে প্রবেশের অনুমতি নেই!');
      window.location.href = './index.html';
      return;
    }

    currentAdminUser = user;
    overlay?.classList.add('hidden');
    initAdminApp();
  } catch (err) {
    console.error('Admin Auth Check Error:', err);
    window.location.href = './index.html';
  }
});

function initAdminApp() {
  setupAdminNav();
  renderAdminTab('dashboard');

  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = './index.html';
  });
}

function setupAdminNav() {
  document.querySelectorAll('.admin-sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.admin-sidebar-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAdminTab(tab);
    });
  });
}

// Router for Admin Tabs
async function renderAdminTab(tab) {
  activeAdminTab = tab;
  const main = document.getElementById('admin-main-content');
  if (!main) return;

  main.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">ডেটা লোড হচ্ছে...</div>`;

  if (tab === 'dashboard') {
    await renderDashboardTab(main);
  } else if (tab === 'products') {
    await renderProductsTab(main);
  } else if (tab === 'categories') {
    await renderCategoriesTab(main);
  } else if (tab === 'banners') {
    await renderBannersTab(main);
  } else if (tab === 'orders') {
    await renderOrdersTab(main);
  } else if (tab === 'customers') {
    await renderCustomersTab(main);
  } else if (tab === 'coupons') {
    await renderCouponsTab(main);
  } else if (tab === 'inventory') {
    await renderInventoryTab(main);
  } else if (tab === 'chat') {
    renderAdminChatTab(main);
  } else if (tab === 'notifications') {
    renderNotificationsTab(main);
  } else if (tab === 'content') {
    await renderContentTab(main);
  }
}

// 1. Dashboard Module
async function renderDashboardTab(container) {
  try {
    const [ordersSnap, productsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'users'))
    ]);

    let totalRevenue = 0;
    let orderCount = ordersSnap.size;
    let productCount = productsSnap.size;
    let userCount = usersSnap.size;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    ordersSnap.forEach(d => {
      const o = d.data();
      if (o.paymentStatus === 'Paid' || o.orderStatus === 'Delivered') {
        totalRevenue += Number(o.grandTotal) || 0;
      }
    });

    productsSnap.forEach(d => {
      const p = d.data();
      const st = Number(p.stock) || 0;
      if (st === 0) outOfStockCount++;
      else if (st <= 5) lowStockCount++;
    });

    container.innerHTML = `
      <div class="space-y-6">
        <h2 class="text-xl font-bold text-slate-800">ওভারভিউ ড্যাশবোর্ড</h2>

        <!-- Stats Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="stat-card">
            <div>
              <p class="text-xs text-slate-500 font-medium">মোট রাজস্ব (রেভিনিউ)</p>
              <h3 class="text-xl font-extrabold text-teal-700 mt-1">${formatPrice(totalRevenue)}</h3>
            </div>
            <div class="stat-icon bg-teal-50 text-teal-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <p class="text-xs text-slate-500 font-medium">মোট অর্ডার</p>
              <h3 class="text-xl font-extrabold text-slate-800 mt-1">${orderCount}</h3>
            </div>
            <div class="stat-icon bg-blue-50 text-blue-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <p class="text-xs text-slate-500 font-medium">নিবন্ধিত কাস্টমার</p>
              <h3 class="text-xl font-extrabold text-slate-800 mt-1">${userCount}</h3>
            </div>
            <div class="stat-icon bg-purple-50 text-purple-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            </div>
          </div>

          <div class="stat-card">
            <div>
              <p class="text-xs text-slate-500 font-medium">স্টক সতর্কবার্তা</p>
              <h3 class="text-xl font-extrabold text-amber-600 mt-1">${lowStockCount} কম / ${outOfStockCount} শেষ</h3>
            </div>
            <div class="stat-icon bg-amber-50 text-amber-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// 2. Product Management Module (With Mandatory Per-Product Delivery Charge & Excel Import/Export)
async function renderProductsTab(container) {
  const [productsSnap, categoriesSnap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'categories'))
  ]);

  const products = [];
  productsSnap.forEach(d => products.push({ id: d.id, ...d.data() }));

  const categories = [];
  categoriesSnap.forEach(d => categories.push(d.data().name));

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 class="text-xl font-bold text-slate-800">প্রোডাক্ট ম্যানেজমেন্ট (${products.length})</h2>
        <div class="flex items-center gap-2">
          <button id="excel-export-btn" class="px-3 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-lg hover:bg-emerald-700">Excel Export</button>
          <button id="open-add-product-btn" class="px-3 py-2 bg-teal-700 text-white font-semibold text-xs rounded-lg hover:bg-teal-800">+ নতুন প্রোডাক্ট</button>
        </div>
      </div>

      <!-- Product List Table -->
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ছবি</th>
              <th>নাম</th>
              <th>ক্যাটাগরি</th>
              <th>মূল্য</th>
              <th>ডেলিভারি চার্জ (৳)</th>
              <th>স্টক</th>
              <th>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td><img src="${p.image || (p.images ? p.images[0] : '')}" class="w-10 h-10 object-cover rounded-lg bg-slate-100" /></td>
                <td class="font-semibold">${escapeHtml(p.name)}</td>
                <td><span class="px-2 py-0.5 bg-slate-100 rounded text-xs">${escapeHtml(p.category || 'সাধারণ')}</span></td>
                <td><span class="font-bold text-teal-700">${formatPrice(p.price)}</span> ${p.discountPrice ? `<span class="text-xs text-slate-400 line-through">${formatPrice(p.discountPrice)}</span>` : ''}</td>
                <td class="font-bold text-emerald-700">${formatPrice(p.deliveryCharge || 0)}</td>
                <td><span class="px-2 py-0.5 rounded font-bold text-xs ${p.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${p.stock || 0}</span></td>
                <td>
                  <div class="flex gap-1">
                    <button class="edit-prod-btn px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-xs font-semibold" data-id="${p.id}">এডিট</button>
                    <button class="del-prod-btn px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-semibold" data-id="${p.id}">মুছুন</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Product Add / Edit Modal Trigger
  container.querySelector('#open-add-product-btn')?.addEventListener('click', () => {
    showProductFormModal(null, categories);
  });

  container.querySelectorAll('.edit-prod-btn').forEach(b => {
    b.addEventListener('click', () => {
      const p = products.find(x => x.id === b.dataset.id);
      showProductFormModal(p, categories);
    });
  });

  container.querySelectorAll('.del-prod-btn').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirm('আপনি কি নিশ্চিত যে এই প্রোডাক্টটি মুছে ফেলতে চান?')) {
        await deleteDoc(doc(db, 'products', b.dataset.id));
        showToast('প্রোডাক্ট মুছে ফেলা হয়েছে', 'info');
        renderAdminTab('products');
      }
    });
  });

  // Excel Export
  container.querySelector('#excel-export-btn')?.addEventListener('click', () => {
    const exportData = products.map(p => ({
      ID: p.id,
      Name: p.name,
      Category: p.category,
      Price: p.price,
      DiscountPrice: p.discountPrice || '',
      DeliveryCharge: p.deliveryCharge || 0,
      Stock: p.stock || 0,
      SKU: p.sku || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "BanglaMart_Products.xlsx");
  });
}

// Product Add / Edit Modal Form
function showProductFormModal(prod, categories) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative">
      <h3 class="font-bold text-slate-800 text-base">${prod ? 'প্রোডাক্ট এডিট করুন' : 'নতুন প্রোডাক্ট যোগ করুন'}</h3>

      <form id="prod-form" class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">প্রোডাক্টের নাম *</label>
          <input type="text" id="p-name" required value="${escapeHtml(prod?.name || '')}" class="w-full p-2 border border-slate-300 rounded-lg" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">মূল্য (৳) *</label>
            <input type="number" id="p-price" required value="${prod?.price || ''}" class="w-full p-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label class="block font-semibold mb-1">ডিসকাউন্ট মূল্য (৳)</label>
            <input type="number" id="p-disc" value="${prod?.discountPrice || ''}" class="w-full p-2 border border-slate-300 rounded-lg" />
          </div>
        </div>

        <!-- Mandatory Per-Product Delivery Charge Field -->
        <div class="p-3 bg-teal-50/60 border border-teal-200 rounded-xl">
          <label class="block font-bold text-teal-800 mb-1">পণ্যভিত্তিক ডেলিভারি চার্জ (৳) *</label>
          <input type="number" id="p-delivery" required value="${prod?.deliveryCharge !== undefined ? prod.deliveryCharge : 60}" class="w-full p-2 border border-slate-300 rounded-lg font-bold text-teal-800 bg-white" placeholder="0 লিখলে ফ্রি ডেলিভারি হবে" />
          <p class="text-[10px] text-teal-600 mt-1">এই প্রোডাক্টের নিজস্ব ডেলিভারি ফি সেট করুন (০ টাকা লিখলে ফ্রি ডেলিভারি)</p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">ক্যাটাগরি *</label>
            <select id="p-cat" required class="w-full p-2 border border-slate-300 rounded-lg">
              ${categories.map(c => `<option value="${escapeHtml(c)}" ${prod?.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">স্টক পরিমাণ *</label>
            <input type="number" id="p-stock" required value="${prod?.stock !== undefined ? prod.stock : 10}" class="w-full p-2 border border-slate-300 rounded-lg" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">ব্র্যান্ড</label>
            <input type="text" id="p-brand" value="${escapeHtml(prod?.brand || '')}" class="w-full p-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label class="block font-semibold mb-1">SKU কোড</label>
            <input type="text" id="p-sku" value="${escapeHtml(prod?.sku || '')}" class="w-full p-2 border border-slate-300 rounded-lg" />
          </div>
        </div>

        <div>
          <label class="block font-semibold mb-1">ছবি URL (কমা দিয়ে একাধিক)</label>
          <input type="text" id="p-imgs" value="${escapeHtml(prod?.image || (prod?.images ? prod.images.join(',') : ''))}" class="w-full p-2 border border-slate-300 rounded-lg" placeholder="https://..." />
        </div>

        <div>
          <label class="block font-semibold mb-1">বিস্তারিত বিবরণ</label>
          <textarea id="p-desc" rows="3" class="w-full p-2 border border-slate-300 rounded-lg">${escapeHtml(prod?.description || '')}</textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="close-modal-btn" class="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg">বাতিল</button>
          <button type="submit" class="px-4 py-2 bg-teal-700 text-white font-semibold rounded-lg hover:bg-teal-800">সংরক্ষণ করুন</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#close-modal-btn').addEventListener('click', () => modal.remove());

  modal.querySelector('#prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const imgs = modal.querySelector('#p-imgs').value.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      name: modal.querySelector('#p-name').value,
      price: Number(modal.querySelector('#p-price').value),
      discountPrice: modal.querySelector('#p-disc').value ? Number(modal.querySelector('#p-disc').value) : null,
      deliveryCharge: Number(modal.querySelector('#p-delivery').value) || 0,
      category: modal.querySelector('#p-cat').value,
      stock: Number(modal.querySelector('#p-stock').value),
      brand: modal.querySelector('#p-brand').value,
      sku: modal.querySelector('#p-sku').value,
      images: imgs,
      image: imgs[0] || '',
      description: modal.querySelector('#p-desc').value,
      updatedAt: new Date().toISOString()
    };

    if (prod) {
      await updateDoc(doc(db, 'products', prod.id), payload);
      showToast('প্রোডাক্ট আপডেট সফল হয়েছে', 'success');
    } else {
      payload.createdAt = new Date().toISOString();
      await addDoc(collection(db, 'products'), payload);
      showToast('নতুন প্রোডাক্ট যোগ করা হয়েছে', 'success');
    }

    modal.remove();
    renderAdminTab('products');
  });
}

// 3. Category Management Module
async function renderCategoriesTab(container) {
  const snap = await getDocs(collection(db, 'categories'));
  const categories = [];
  snap.forEach(d => categories.push({ id: d.id, ...d.data() }));

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-800">ক্যাটাগরি ম্যানেজমেন্ট (${categories.length})</h2>
        <button id="add-cat-btn" class="px-3 py-2 bg-teal-700 text-white font-semibold text-xs rounded-lg">+ নতুন ক্যাটাগরি</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        ${categories.map(c => `
          <div class="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <span class="font-bold text-slate-800 text-sm">${escapeHtml(c.name)}</span>
            <button class="del-cat-btn px-2 py-1 bg-red-50 text-red-600 rounded text-xs" data-id="${c.id}">মুছুন</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelector('#add-cat-btn')?.addEventListener('click', async () => {
    const name = prompt('নতুন ক্যাটাগরির নাম লিখুন:');
    if (name) {
      await addDoc(collection(db, 'categories'), { name: name.trim() });
      showToast('ক্যাটাগরি যোগ করা হয়েছে', 'success');
      renderAdminTab('categories');
    }
  });

  container.querySelectorAll('.del-cat-btn').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirm('ক্যাটাগরি মুছে ফেলতে চান?')) {
        await deleteDoc(doc(db, 'categories', b.dataset.id));
        showToast('ক্যাটাগরি মোছা হয়েছে', 'info');
        renderAdminTab('categories');
      }
    });
  });
}

// 4. Banner Management Module
async function renderBannersTab(container) {
  let banners = [];
  try {
    const snap = await getDocs(query(collection(db, 'banners'), orderBy('createdAt', 'desc')));
    snap.forEach(d => banners.push({ id: d.id, ...d.data() }));
  } catch (err) {
    const snap = await getDocs(collection(db, 'banners'));
    snap.forEach(d => banners.push({ id: d.id, ...d.data() }));
  }

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-800">স্লাইডার ব্যনার ম্যানেজমেন্ট (${banners.length})</h2>
          <p class="text-xs text-slate-500 mt-0.5">এডমিন প্যানেল থেকে যোগ করা ব্যনারগুলোই কেবল হোমপেজ স্লাইডারে দেখাবে</p>
        </div>
        <button id="add-banner-btn" class="px-3 py-2 bg-teal-700 text-white font-semibold text-xs rounded-lg hover:bg-teal-800 transition">+ নতুন ব্যনার</button>
      </div>

      ${banners.length === 0 ? `
        <div class="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl text-center space-y-2">
          <svg class="w-10 h-10 mx-auto text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <h3 class="font-bold text-sm">বর্তমানে কোনো স্লাইডার ব্যনার নেই</h3>
          <p class="text-xs text-amber-700">হোমপেজে স্লাইডার ব্যনার দেখানোর জন্য উপরের '+ নতুন ব্যনার' বাটনে ক্লিক করে প্রথম ব্যনারটি যোগ করুন।</p>
        </div>
      ` : `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          ${banners.map(b => `
            <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
              <div class="h-36 bg-slate-100 overflow-hidden relative">
                <img src="${escapeHtml(b.imageUrl)}" class="w-full h-full object-cover" />
              </div>
              <div class="p-3 flex items-center justify-between gap-2 flex-1">
                <div>
                  <h4 class="font-bold text-slate-800 text-xs">${escapeHtml(b.title || 'শিরোনাম নেই')}</h4>
                  <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-1">${escapeHtml(b.subtitle || 'উপ-শিরোনাম নেই')}</p>
                  ${b.linkedCategoryId ? `<span class="inline-block mt-1 px-2 py-0.5 bg-teal-50 text-teal-700 font-semibold text-[10px] rounded">ক্যাটাগরি লিঙ্কড</span>` : ''}
                </div>
                <div class="flex items-center gap-1">
                  <button class="edit-banner-btn px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md text-xs font-semibold" data-id="${b.id}">এডিট</button>
                  <button class="del-banner-btn px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-xs font-semibold" data-id="${b.id}">মুছুন</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;

  container.querySelector('#add-banner-btn')?.addEventListener('click', async () => {
    await showBannerFormModal();
  });

  container.querySelectorAll('.edit-banner-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const bannerObj = banners.find(x => x.id === b.dataset.id);
      await showBannerFormModal(bannerObj);
    });
  });

  container.querySelectorAll('.del-banner-btn').forEach(b => {
    b.addEventListener('click', async () => {
      if (confirm('আপনি কি এই ব্যনারটি মুছে ফেলতে চান?')) {
        await deleteDoc(doc(db, 'banners', b.dataset.id));
        showToast('ব্যনার মুছে ফেলা হয়েছে', 'info');
        renderAdminTab('banners');
      }
    });
  });
}

async function showBannerFormModal(banner = null) {
  let categories = [];
  try {
    const catSnap = await getDocs(collection(db, 'categories'));
    catSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching categories for banner modal:', err);
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
      <h3 class="font-bold text-slate-800 text-base">${banner ? 'ব্যনার এডিট করুন' : 'নতুন স্লাইডার ব্যনার যোগ করুন'}</h3>

      <form id="banner-form" class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">ব্যনার ছবির URL *</label>
          <input type="text" id="b-url" required value="${escapeHtml(banner?.imageUrl || '')}" class="w-full p-2 border border-slate-300 rounded-lg" placeholder="https://..." />
        </div>

        <div>
          <label class="block font-semibold mb-1">শিরোনাম (Title)</label>
          <input type="text" id="b-title" value="${escapeHtml(banner?.title || '')}" class="w-full p-2 border border-slate-300 rounded-lg" placeholder="যেমন: ঈদ স্পেশাল ডিসকাউন্ট!" />
        </div>

        <div>
          <label class="block font-semibold mb-1">উপ-শিরোনাম / অফার বার্তা (Subtitle)</label>
          <input type="text" id="b-subtitle" value="${escapeHtml(banner?.subtitle || '')}" class="w-full p-2 border border-slate-300 rounded-lg" placeholder="যেমন: সব প্রোডাক্টে ৩০% ছাড়..." />
        </div>

        <div>
          <label class="block font-semibold mb-1">ক্যাটাগরি (Category Link)</label>
          <select id="b-category" class="w-full p-2 border border-slate-300 rounded-lg bg-white">
            <option value="">কোনোটি না (None)</option>
            ${categories.map(c => `
              <option value="${escapeHtml(c.name)}" ${banner?.linkedCategoryId === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>
            `).join('')}
          </select>
          <p class="text-[10px] text-slate-400 mt-1">এই ব্যনারে ক্লিক করলে ব্যবহারকারী নির্দিষ্ট ক্যাটাগরিতে চলে যাবে।</p>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" id="close-banner-modal-btn" class="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg">বাতিল</button>
          <button type="submit" class="px-4 py-2 bg-teal-700 text-white font-semibold rounded-lg hover:bg-teal-800">সংরক্ষণ করুন</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#close-banner-modal-btn').addEventListener('click', () => modal.remove());

  modal.querySelector('#banner-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = modal.querySelector('#b-url').value.trim();
    const title = modal.querySelector('#b-title').value.trim();
    const subtitle = modal.querySelector('#b-subtitle').value.trim();
    const linkedCategoryId = modal.querySelector('#b-category').value;

    if (!url) return;

    const payload = {
      imageUrl: url,
      title: title,
      subtitle: subtitle,
      linkedCategoryId: linkedCategoryId || '',
      updatedAt: new Date().toISOString()
    };

    if (banner) {
      await updateDoc(doc(db, 'banners', banner.id), payload);
      showToast('ব্যনার আপডেট করা হয়েছে', 'success');
    } else {
      payload.createdAt = new Date().toISOString();
      await addDoc(collection(db, 'banners'), payload);
      showToast('নতুন ব্যনার যোগ করা হয়েছে', 'success');
    }

    modal.remove();
    renderAdminTab('banners');
  });
}

// 5. Order Management Module
async function renderOrdersTab(container) {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const orders = [];
  snap.forEach(d => orders.push({ id: d.id, ...d.data() }));

  container.innerHTML = `
    <div class="space-y-4">
      <h2 class="text-xl font-bold text-slate-800">অর্ডার ম্যানেজমেন্ট (${orders.length})</h2>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>অর্ডার নম্বর</th>
              <th>গ্রাহক</th>
              <th>মূল্য</th>
              <th>পেমেন্ট মেথড</th>
              <th>পেমেন্ট স্ট্যাটাস</th>
              <th>ডেলিভারি স্ট্যাটাস</th>
              <th>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td class="font-bold text-teal-700">${escapeHtml(o.orderNumber)}</td>
                <td>
                  <div class="font-semibold text-slate-800">${escapeHtml(o.customerInfo?.fullName || 'N/A')}</div>
                  <div class="text-[10px] text-slate-500">${escapeHtml(o.customerInfo?.phone || '')}</div>
                </td>
                <td class="font-bold">${formatPrice(o.grandTotal)}</td>
                <td class="uppercase font-semibold text-xs">${escapeHtml(o.paymentMethod)} ${o.trxId ? `<span class="text-[10px] text-teal-600 block">Trx: ${escapeHtml(o.trxId)}</span>` : ''}</td>
                <td>
                  <select class="pay-status-sel text-xs border border-slate-300 rounded px-1.5 py-1" data-id="${o.id}">
                    <option value="Unpaid" ${o.paymentStatus === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                    <option value="Pending Verification" ${o.paymentStatus === 'Pending Verification' ? 'selected' : ''}>Pending</option>
                    <option value="Paid" ${o.paymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
                  </select>
                </td>
                <td>
                  <select class="del-status-sel text-xs border border-slate-300 rounded px-1.5 py-1" data-id="${o.id}">
                    <option value="Processing" ${o.orderStatus === 'Processing' ? 'selected' : ''}>Processing</option>
                    <option value="Shipped" ${o.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="Out for Delivery" ${o.orderStatus === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                    <option value="Delivered" ${o.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="Cancelled" ${o.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                  </select>
                </td>
                <td>
                  <button class="view-order-detail-btn px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs font-bold" data-id="${o.id}">ডিটেইলস</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll('.pay-status-sel').forEach(sel => {
    sel.addEventListener('change', async () => {
      const orderId = sel.dataset.id;
      const newStatus = sel.value;
      await updateDoc(doc(db, 'orders', orderId), { paymentStatus: newStatus });
      showToast('পেমেন্ট স্ট্যাটাস আপডেট করা হয়েছে', 'success');

      try {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (orderSnap.exists()) {
          const oData = orderSnap.data();
          if (oData.userId && oData.userId !== 'guest') {
            await addDoc(collection(db, 'notifications'), {
              userId: oData.userId,
              title: `পেমেন্ট আপডেট (#${oData.orderNumber})`,
              body: `আপনার অর্ডারের পেমেন্ট স্ট্যাটাস পরিবর্তন হয়ে "${newStatus}" হয়েছে।`,
              createdAt: new Date().toISOString(),
              read: false
            });
          }
        }
      } catch (err) {
        console.error('Error creating notification on payment change:', err);
      }
    });
  });

  container.querySelectorAll('.del-status-sel').forEach(sel => {
    sel.addEventListener('change', async () => {
      const orderId = sel.dataset.id;
      const newStatus = sel.value;
      await updateDoc(doc(db, 'orders', orderId), { orderStatus: newStatus });
      showToast('ডেলিভারি স্ট্যাটাস আপডেট করা হয়েছে', 'success');

      try {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (orderSnap.exists()) {
          const oData = orderSnap.data();
          if (oData.userId && oData.userId !== 'guest') {
            await addDoc(collection(db, 'notifications'), {
              userId: oData.userId,
              title: `অর্ডার ডেলিভারি আপডেট (#${oData.orderNumber})`,
              body: `আপনার অর্ডারের ডেলিভারি স্ট্যাটাস পরিবর্তন হয়ে "${newStatus}" হয়েছে।`,
              createdAt: new Date().toISOString(),
              read: false
            });
          }
        }
      } catch (err) {
        console.error('Error creating notification on delivery change:', err);
      }
    });
  });

  // Attach event listener to Details button
  container.querySelectorAll('.view-order-detail-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      try {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (orderSnap.exists()) {
          showOrderDetailsModal(orderSnap.id, orderSnap.data());
        } else {
          showToast('অর্ডার পাওয়া যায়নি', 'error');
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
        showToast('অর্ডারের তথ্য লোড করা যায়নি', 'error');
      }
    });
  });
}

// Order Details Modal
function showOrderDetailsModal(orderId, order) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200';
  modal.id = 'order-details-modal';

  const cInfo = order.customerInfo || {};
  const items = order.items || [];

  modal.innerHTML = `
    <div class="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-y-auto p-6 shadow-2xl relative flex flex-col gap-4 text-left">
      <button id="close-order-modal-btn" class="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      <div class="border-b pb-3 border-slate-200">
        <span class="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded">অর্ডার নম্বর: #${escapeHtml(order.orderNumber)}</span>
        <h2 class="text-lg font-bold text-slate-900 mt-2">অর্ডার বিবরণী</h2>
        <p class="text-xs text-slate-500">তারিখ: ${new Date(order.createdAt).toLocaleString('bn-BD')}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <!-- Customer & Shipping details -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
          <h3 class="font-bold text-slate-800 text-sm border-b pb-1">গ্রাহক ও ডেলিভারি তথ্য</h3>
          <div><span class="font-semibold text-slate-500">নাম:</span> <span class="font-bold text-slate-800">${escapeHtml(cInfo.fullName || 'N/A')}</span></div>
          <div><span class="font-semibold text-slate-500">মোবাইল:</span> <span class="font-bold text-slate-800">${escapeHtml(cInfo.phone || 'N/A')}</span></div>
          <div><span class="font-semibold text-slate-500">বিভাগ:</span> <span class="text-slate-800">${escapeHtml(cInfo.division || 'N/A')}</span></div>
          <div><span class="font-semibold text-slate-500">জেলা:</span> <span class="text-slate-800">${escapeHtml(cInfo.district || 'N/A')}</span></div>
          <div><span class="font-semibold text-slate-500">উপজেলা/থানা:</span> <span class="text-slate-800">${escapeHtml(cInfo.upazila || 'N/A')}</span></div>
          <div><span class="font-semibold text-slate-500">এলাকা:</span> <span class="text-slate-800">${escapeHtml(cInfo.area || 'N/A')}</span></div>
          <div><span class="font-semibold text-slate-500">বিস্তারিত ঠিকানা:</span> <span class="text-slate-800">${escapeHtml(cInfo.address || 'N/A')}</span></div>
          ${cInfo.note ? `<div class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-900"><span class="font-semibold">ডেলিভারি নোট:</span> ${escapeHtml(cInfo.note)}</div>` : ''}
        </div>

        <!-- Payment Info & Status -->
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 flex flex-col justify-between">
          <div class="space-y-2">
            <h3 class="font-bold text-slate-800 text-sm border-b pb-1">পেমেন্ট ও স্ট্যাটাস</h3>
            <div><span class="font-semibold text-slate-500">পেমেন্ট পদ্ধতি:</span> <span class="font-bold text-slate-800 uppercase">${escapeHtml(order.paymentMethod || 'N/A')}</span></div>
            ${order.trxId ? `<div><span class="font-semibold text-slate-500">Trx ID:</span> <span class="font-bold text-teal-700">${escapeHtml(order.trxId)}</span></div>` : ''}
            <div><span class="font-semibold text-slate-500">পেমেন্ট স্ট্যাটাস:</span> <span class="font-bold px-2 py-0.5 rounded text-[10px] ${order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${escapeHtml(order.paymentStatus || 'Unpaid')}</span></div>
            <div><span class="font-semibold text-slate-500">ডেলিভারি স্ট্যাটাস:</span> <span class="font-bold px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800">${escapeHtml(order.orderStatus || 'Processing')}</span></div>
          </div>
        </div>
      </div>

      <!-- Ordered Items -->
      <div class="space-y-2">
        <h3 class="font-bold text-slate-800 text-xs sm:text-sm">অর্ডারকৃত পণ্যসমূহ (${items.length})</h3>
        <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
          ${items.map(item => `
            <div class="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition">
              <div class="flex items-center gap-2">
                <img src="${getValidImageUrl(item.image)}" class="w-10 h-10 object-cover rounded-lg border border-slate-100" />
                <div>
                  <h4 class="font-semibold text-slate-800 line-clamp-1">${escapeHtml(item.name)}</h4>
                  <p class="text-slate-500 text-[10px]">মূল্য: ${formatPrice(item.price)} x ${item.qty}</p>
                </div>
              </div>
              <div class="font-bold text-slate-900">${formatPrice(item.price * item.qty)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Financial Calculation Summary -->
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-1.5 ml-auto w-full max-w-sm">
        <div class="flex justify-between text-slate-600">
          <span>সাবটোটাল:</span>
          <span>${formatPrice(order.subtotal || 0)}</span>
        </div>
        <div class="flex justify-between text-slate-600">
          <span>ডেলিভারি চার্জ:</span>
          <span>${formatPrice(order.deliveryChargeTotal || 0)}</span>
        </div>
        ${order.couponDiscount ? `
          <div class="flex justify-between text-emerald-600 font-semibold">
            <span>কুপন ছাড়:</span>
            <span>-${formatPrice(order.couponDiscount)}</span>
          </div>
        ` : ''}
        <div class="flex justify-between text-sm font-extrabold text-teal-800 border-t pt-1.5 mt-1.5 border-slate-200">
          <span>সর্বমোট দেয় টাকা:</span>
          <span>${formatPrice(order.grandTotal || 0)}</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#close-order-modal-btn').addEventListener('click', () => {
    modal.remove();
  });
}

// 6. Customer List Module
async function renderCustomersTab(container) {
  const snap = await getDocs(collection(db, 'users'));
  const customers = [];
  snap.forEach(d => customers.push({ id: d.id, ...d.data() }));

  container.innerHTML = `
    <div class="space-y-4">
      <h2 class="text-xl font-bold text-slate-800">নিবন্ধিত কাস্টমার তালিকা (${customers.length})</h2>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>নাম</th>
              <th>ইমেইল</th>
              <th>ফোন</th>
              <th>রোল</th>
              <th>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            ${customers.map(c => `
              <tr>
                <td class="font-semibold text-slate-800">${escapeHtml(c.fullName || 'N/A')}</td>
                <td>${escapeHtml(c.email || 'N/A')}</td>
                <td>${escapeHtml(c.phone || 'N/A')}</td>
                <td><span class="px-2 py-0.5 rounded text-xs font-bold uppercase ${c.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}">${escapeHtml(c.role || 'customer')}</span></td>
                <td>
                  ${c.role !== 'admin' ? `<button class="delete-user-btn px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-semibold transition" data-id="${c.id}">ইউজার মুছুন</button>` : '<span class="text-xs text-slate-400">অ্যাডমিন</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.id;
      if (!confirm('এই ইউজারকে মুছে ফেলা হবে, নিশ্চিত?')) return;

      try {
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to delete auth user');
        }

        await deleteDoc(doc(db, 'users', userId));

        try { await deleteDoc(doc(db, 'cart', userId)); } catch (e) {}
        try { await deleteDoc(doc(db, 'wishlist', userId)); } catch (e) {}
        try {
          const msgSnap = await getDocs(collection(db, 'chats', userId, 'messages'));
          for (const mDoc of msgSnap.docs) {
            await deleteDoc(mDoc.ref);
          }
          await deleteDoc(doc(db, 'chats', userId));
        } catch (e) {}

        showToast('ইউজার সফলভাবে মুছে ফেলা হয়েছে', 'success');
        renderAdminTab('customers');
      } catch (err) {
        console.error('Error deleting user:', err);
        showToast('ইউজার মুছতে সমস্যা হয়েছে: ' + (err.message || ''), 'error');
      }
    });
  });
}

// 7. Coupon Management Module
async function renderCouponsTab(container) {
  const snap = await getDocs(collection(db, 'coupons'));
  const coupons = [];
  snap.forEach(d => coupons.push({ id: d.id, ...d.data() }));

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-slate-800">কুপন ম্যানেজমেন্ট (${coupons.length})</h2>
        <button id="add-coupon-btn" class="px-3 py-2 bg-teal-700 text-white font-semibold text-xs rounded-lg">+ নতুন কুপন</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        ${coupons.map(cp => `
          <div class="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span class="font-extrabold text-teal-700 text-sm uppercase">${escapeHtml(cp.code)}</span>
              <p class="text-xs text-slate-500">ছাড়: ${cp.type === 'percentage' ? `${cp.value}%` : formatPrice(cp.value)}</p>
            </div>
            <button class="del-coupon-btn px-2 py-1 bg-red-50 text-red-600 rounded text-xs" data-id="${cp.id}">মুছুন</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelector('#add-coupon-btn')?.addEventListener('click', async () => {
    const code = prompt('কুপন কোড (যেমন: SAVE50):');
    const val = prompt('ছাড়ের পরিমাণ (টাকা বা পার্সেন্ট):');
    if (code && val) {
      await addDoc(collection(db, 'coupons'), {
        code: code.trim().toUpperCase(),
        value: Number(val),
        type: 'fixed',
        createdAt: new Date().toISOString()
      });
      showToast('কুপন তৈরি করা হয়েছে', 'success');
      renderAdminTab('coupons');
    }
  });

  container.querySelectorAll('.del-coupon-btn').forEach(b => {
    b.addEventListener('click', async () => {
      await deleteDoc(doc(db, 'coupons', b.dataset.id));
      renderAdminTab('coupons');
    });
  });
}

// 8. Inventory Module
async function renderInventoryTab(container) {
  const snap = await getDocs(collection(db, 'products'));
  const products = [];
  snap.forEach(d => products.push({ id: d.id, ...d.data() }));

  container.innerHTML = `
    <div class="space-y-4">
      <h2 class="text-xl font-bold text-slate-800">স্টক ও ইনভেন্টরি আপডেট</h2>

      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>প্রোডাক্ট</th>
              <th>বর্তমান স্টক</th>
              <th>দ্রুত আপডেট</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td class="font-semibold">${escapeHtml(p.name)}</td>
                <td><span class="px-2 py-0.5 rounded font-bold text-xs ${p.stock <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100'}">${p.stock || 0}</span></td>
                <td>
                  <div class="flex items-center gap-2">
                    <input type="number" class="inv-input w-20 p-1 text-xs border border-slate-300 rounded" value="${p.stock || 0}" data-id="${p.id}" />
                    <button class="save-inv-btn px-2 py-1 bg-slate-800 text-white text-xs rounded" data-id="${p.id}">সেভ</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll('.save-inv-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      const input = container.querySelector(`.inv-input[data-id="${id}"]`);
      if (input) {
        await updateDoc(doc(db, 'products', id), { stock: Number(input.value) });
        showToast('স্টক আপডেট সফল হয়েছে', 'success');
      }
    });
  });
}

// 9. Admin Chat Dashboard
function renderAdminChatTab(container) {
  container.innerHTML = `
    <div class="admin-chat-grid">
      <!-- Chat user list -->
      <div class="border-r border-slate-200 overflow-y-auto" id="admin-chat-user-list">
        <div class="p-3 text-xs text-slate-400">চ্যাট তালিকা লোড হচ্ছে...</div>
      </div>

      <!-- Chat thread view -->
      <div class="flex flex-col h-full bg-slate-50" id="admin-chat-thread">
        <div class="flex-1 flex items-center justify-center p-6 text-slate-400 text-xs text-center">
          বাঁদিকের তালিকা থেকে যেকোনো গ্রাহক নির্বাচন করুন
        </div>
      </div>
    </div>
  `;

  // Listen to all active chats
  onSnapshot(collection(db, 'chats'), (snapshot) => {
    const listContainer = container.querySelector('#admin-chat-user-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (snapshot.empty) {
      listContainer.innerHTML = `<div class="p-4 text-xs text-slate-400">কোনো একটিভ চ্যাট নেই</div>`;
      return;
    }

    snapshot.forEach(d => {
      const c = d.data();
      const item = document.createElement('div');
      item.className = 'p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer text-xs';
      item.innerHTML = `
        <div class="flex items-center justify-between font-bold text-slate-800">
          <span>${escapeHtml(c.userName || 'গ্রাহক')}</span>
          ${c.unreadAdmin ? `<span class="w-2 h-2 rounded-full bg-red-500"></span>` : ''}
        </div>
        <p class="text-slate-500 truncate mt-0.5">${escapeHtml(c.lastMessage || '')}</p>
      `;

      item.addEventListener('click', () => {
        openAdminChatThread(d.id, c, container.querySelector('#admin-chat-thread'));
      });

      listContainer.appendChild(item);
    });
  });
}

function openAdminChatThread(chatId, chatMeta, threadBox) {
  threadBox.innerHTML = `
    <div class="p-3 border-b border-slate-200 bg-white font-bold text-xs text-slate-800">
      ${escapeHtml(chatMeta.userName || 'গ্রাহক')} - ${escapeHtml(chatMeta.userEmail || '')}
    </div>

    <div id="admin-msg-box" class="flex-1 p-3 overflow-y-auto space-y-2"></div>

    <form id="admin-chat-form" class="p-2 bg-white border-t border-slate-200 flex gap-2">
      <input type="text" id="admin-msg-input" placeholder="উত্তর লিখুন..." class="flex-1 text-xs p-2 border border-slate-300 rounded-lg focus:outline-none" />
      <button type="submit" class="px-4 py-2 bg-teal-700 text-white font-bold text-xs rounded-lg">পাঠান</button>
    </form>
  `;

  // Listen to messages
  const msgBox = threadBox.querySelector('#admin-msg-box');
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  onSnapshot(q, (snapshot) => {
    msgBox.innerHTML = '';
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const isAdmin = msg.sender === 'admin';

      const b = document.createElement('div');
      b.className = `p-2 rounded-xl text-xs max-w-[80%] relative group ${isAdmin ? 'bg-teal-700 text-white ml-auto' : 'bg-white text-slate-800 border border-slate-200'}`;
      b.innerHTML = `
        <div>${escapeHtml(msg.text || '')}</div>
        <div class="flex items-center justify-between text-[10px] opacity-70 mt-1 gap-2">
          <button class="admin-del-msg text-rose-300 hover:text-white underline cursor-pointer" data-id="${docSnap.id}">মুছুন</button>
          <span>${msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      `;

      b.querySelector('.admin-del-msg')?.addEventListener('click', async () => {
        if (confirm('অ্যাডমিন হিসেবে এই মেসেজটি মুছে ফেলতে চান?')) {
          try {
            await deleteDoc(doc(db, 'chats', chatId, 'messages', docSnap.id));
            showToast('মেসেজ মুছে ফেলা হয়েছে', 'success');
          } catch (err) {
            console.error('Error deleting message as admin:', err);
            showToast('মেসেজ মোছা যায়নি', 'error');
          }
        }
      });

      msgBox.appendChild(b);
    });
    msgBox.scrollTop = msgBox.scrollHeight;
  });

  // Clear unread flag
  updateDoc(doc(db, 'chats', chatId), { unreadAdmin: false });

  // Form submit
  threadBox.querySelector('#admin-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = threadBox.querySelector('#admin-msg-input');
    const txt = input.value.trim();
    if (txt) {
      await addDoc(messagesRef, {
        sender: 'admin',
        text: txt,
        timestamp: new Date().toISOString()
      });
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: txt,
        lastUpdated: new Date().toISOString()
      });
      input.value = '';
    }
  });
}

// 10. Notifications Module
async function renderNotificationsTab(container) {
  let users = [];
  try {
    const userSnap = await getDocs(collection(db, 'users'));
    userSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error fetching users for notifications:', err);
  }

  container.innerHTML = `
    <div class="space-y-6 max-w-5xl">
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 max-w-xl">
        <h2 class="text-xl font-bold text-slate-800">পেশ নোটিফিকেশন পাঠান</h2>

        <form id="send-notif-form" class="space-y-3 text-xs">
          <div>
            <label class="block font-semibold mb-1">প্রাপক (Target) *</label>
            <select id="n-target-type" class="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold">
              <option value="all">সবার জন্য (Broadcast - All Users)</option>
              <option value="individual">নির্দিষ্ট ইউজার (Individual User)</option>
            </select>
          </div>

          <div id="n-user-select-container" class="hidden">
            <label class="block font-semibold mb-1">কাস্টমার নির্বাচন করুন *</label>
            <select id="n-user-id" class="w-full p-2 border border-slate-300 rounded-lg bg-white">
              <option value="">-- ইউজার বেছে নিন --</option>
              ${users.filter(u => u.role !== 'admin').map(u => `
                <option value="${u.id}">${escapeHtml(u.fullName || 'নামহীন')} (${escapeHtml(u.email || u.phone || u.id)})</option>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="block font-semibold mb-1">নোটিফিকেশন শিরোনাম *</label>
            <input type="text" id="n-title" required placeholder="আজকের বিশেষ ছাড়!" class="w-full p-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label class="block font-semibold mb-1">বার্তা (Body) *</label>
            <textarea id="n-body" required rows="3" placeholder="সব ক্যাটাগরিতে ২০% পর্যন্ত ফ্ল্যাট অফার..." class="w-full p-2 border border-slate-300 rounded-lg"></textarea>
          </div>
          <button type="submit" class="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition shadow-sm">নোটিফিকেশন পাঠান</button>
        </form>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-bold text-slate-800">অ্যাডমিন কর্তৃক প্রেরিত নোটিফিকেশনসমূহ</h3>
        <div id="admin-sent-notifs-list" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div class="p-4 text-xs text-slate-400">লোড হচ্ছে...</div>
        </div>
      </div>
    </div>
  `;

  const targetTypeSel = container.querySelector('#n-target-type');
  const userSelectContainer = container.querySelector('#n-user-select-container');

  targetTypeSel.addEventListener('change', () => {
    if (targetTypeSel.value === 'individual') {
      userSelectContainer.classList.remove('hidden');
    } else {
      userSelectContainer.classList.add('hidden');
    }
  });

  container.querySelector('#send-notif-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetType = targetTypeSel.value;
    const userId = targetType === 'individual' ? container.querySelector('#n-user-id').value : 'all';
    const title = container.querySelector('#n-title').value.trim();
    const body = container.querySelector('#n-body').value.trim();

    if (targetType === 'individual' && !userId) {
      showToast('দয়া করে একজন কাস্টমার নির্বাচন করুন', 'error');
      return;
    }

    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        body,
        sentByAdmin: true,
        createdAt: new Date().toISOString(),
        read: false
      });

      showToast('নোটিফিকেশন সফলভাবে পাঠানো হয়েছে', 'success');
      container.querySelector('#send-notif-form').reset();
      userSelectContainer.classList.add('hidden');
    } catch (err) {
      console.error('Error sending notification:', err);
      showToast('নোটিফিকেশন পাঠাতে সমস্যা হয়েছে', 'error');
    }
  });

  // Listen to admin-sent notifications
  const notifsListContainer = container.querySelector('#admin-sent-notifs-list');
  const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));

  onSnapshot(q, (snapshot) => {
    if (!notifsListContainer) return;
    const notifs = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.sentByAdmin === true) {
        notifs.push({ id: docSnap.id, ...data });
      }
    });

    if (notifs.length === 0) {
      notifsListContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">কোনো অ্যাডমিন নোটিফিকেশন পাঠানো হয়নি</div>`;
      return;
    }

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    notifsListContainer.innerHTML = `
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ধরন (Type)</th>
              <th>প্রাপক (Target)</th>
              <th>শিরোনাম ও বার্তা</th>
              <th>তারিখ ও সময়</th>
              <th>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            ${notifs.map(n => {
              const isAll = n.userId === 'all';
              const targetUser = userMap[n.userId];
              const targetName = isAll ? 'সবাই (Broadcast)' : (targetUser ? `${escapeHtml(targetUser.fullName || '')} (${escapeHtml(targetUser.email || targetUser.phone || n.userId)})` : n.userId);

              return `
                <tr>
                  <td>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isAll ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}">
                      ${isAll ? 'সবার জন্য' : 'ব্যক্তিগত'}
                    </span>
                  </td>
                  <td class="font-semibold text-slate-800 text-xs">${targetName}</td>
                  <td>
                    <div class="font-bold text-slate-900">${escapeHtml(n.title)}</div>
                    <div class="text-slate-500 text-[11px] line-clamp-2 mt-0.5">${escapeHtml(n.body)}</div>
                  </td>
                  <td class="text-slate-500 text-[11px] whitespace-nowrap">${n.createdAt ? new Date(n.createdAt).toLocaleString('bn-BD') : 'N/A'}</td>
                  <td>
                    <button class="del-admin-notif px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-semibold transition" data-id="${n.id}">মুছুন</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    notifsListContainer.querySelectorAll('.del-admin-notif').forEach(btn => {
      btn.addEventListener('click', async () => {
        const notifId = btn.dataset.id;
        if (!confirm('এই নোটিফিকেশনটি মুছে ফেলতে চান?')) return;

        try {
          await deleteDoc(doc(db, 'notifications', notifId));
          showToast('নোটিফিকেশন সফলভাবে মুছে ফেলা হয়েছে', 'success');
        } catch (err) {
          console.error('Error deleting notification:', err);
          showToast('নোটিফিকেশন মোছা যায়নি', 'error');
        }
      });
    });
  });
}

// 11. Page Content Management Module
async function renderContentTab(container) {
  container.innerHTML = `<div class="p-4 text-slate-500 text-xs">পেজ কন্টেন্ট লোড হচ্ছে...</div>`;
  try {
    const docRef = doc(db, 'settings', 'pageContents');
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : {};

    container.innerHTML = `
      <div class="space-y-6 max-w-4xl">
        <div class="pb-3 border-b border-slate-200">
          <h2 class="text-xl font-bold text-slate-800">পেজ কন্টেন্ট ম্যানেজমেন্ট (Page Content)</h2>
          <p class="text-xs text-slate-500 mt-1">হেল্প সেন্টার, যোগাযোগ এবং আমাদের সম্পর্কে পেজের কন্টেন্ট পরিবর্তন করুন</p>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-6">
          <!-- Help Center -->
          <div class="space-y-2">
            <label class="block text-xs font-bold text-slate-700">হেল্প সেন্টার কন্টেন্ট (Help Center)</label>
            <textarea id="help-content-input" rows="5" class="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="হেল্প সেন্টার সম্পর্কিত তথ্য লিখুন...">${escapeHtml(data.helpCenterContent || '')}</textarea>
          </div>

          <!-- Contact Us -->
          <div class="space-y-2">
            <label class="block text-xs font-bold text-slate-700">যোগাযোগ কন্টেন্ট (Contact Us)</label>
            <textarea id="contact-content-input" rows="5" class="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="যোগাযোগ সম্পর্কিত তথ্য লিখুন...">${escapeHtml(data.contactUsContent || '')}</textarea>
          </div>

          <!-- About Us -->
          <div class="space-y-2">
            <label class="block text-xs font-bold text-slate-700">আমাদের সম্পর্কে কন্টেন্ট (About Us)</label>
            <textarea id="about-content-input" rows="5" class="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="আমাদের সম্পর্কে তথ্য লিখুন...">${escapeHtml(data.aboutContent || '')}</textarea>
          </div>

          <div class="flex justify-end pt-2">
            <button id="save-pages-btn" class="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-sm transition">সব পেজ কন্টেন্ট সেভ করুন</button>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#save-pages-btn').addEventListener('click', async () => {
      const helpCenterContent = container.querySelector('#help-content-input').value.trim();
      const contactUsContent = container.querySelector('#contact-content-input').value.trim();
      const aboutContent = container.querySelector('#about-content-input').value.trim();

      try {
        await setDoc(doc(db, 'settings', 'pageContents'), {
          helpCenterContent,
          contactUsContent,
          aboutContent,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        showToast('সকল পেজের কন্টেন্ট সফলভাবে সেভ করা হয়েছে!', 'success');
      } catch (err) {
        console.error('Error saving page contents:', err);
        showToast('কন্টেন্ট সেভ করতে সমস্যা হয়েছে', 'error');
      }
    });

  } catch (err) {
    console.error('Error loading page contents:', err);
    container.innerHTML = `<p class="text-xs text-red-500">কন্টেন্ট লোড করতে সমস্যা হয়েছে।</p>`;
  }
}

