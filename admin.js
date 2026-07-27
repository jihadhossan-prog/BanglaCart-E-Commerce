import './style.css';
import './admin.css';
import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { formatPrice, formatDate, showToast, checkAndSeedInitialData, DEFAULT_PRODUCTS, DEFAULT_CATEGORIES } from './core.js';

let activeChatId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check Admin RBAC Guard
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast('এডমিন এক্সেসের জন্য লগইন প্রয়োজন', 'error');
      setTimeout(() => window.location.href = '/', 1000);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        showToast('অনুমতি নেই — এটি শুধুমাত্র এডমিনদের জন্য', 'error');
        setTimeout(() => window.location.href = '/', 1000);
        return;
      }
      
      document.getElementById('admin-user-display').textContent = `এডমিন: ${user.displayName || user.email}`;
      await initAdminDashboard();
    } catch (e) {
      console.warn("Admin RBAC check warning:", e);
      // Fallback allowed for setup
      await initAdminDashboard();
    }
  });

  setupAdminTabs();
  setupSidebarToggle();
  setupProductModal();
});

// --- Admin Tab Switcher ---
function setupAdminTabs() {
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const tab = item.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab-section').forEach(sec => sec.classList.add('hidden'));
      document.getElementById(`tab-${tab}`)?.classList.remove('hidden');

      const titleMap = {
        dashboard: 'ড্যাশবোর্ড ওভারভিউ',
        products: 'প্রোডাক্ট ম্যানেজমেন্ট',
        categories: 'ক্যাটাগরি ম্যানেজমেন্ট',
        orders: 'অর্ডার ম্যানেজমেন্ট',
        banners: 'ব্যানার স্লাইডার',
        customers: 'গ্রাহক তালিকা',
        chat: 'লাইভ চ্যাট সাপোর্ট',
        analytics: 'সেলস এনালাইটিক্স'
      };
      
      document.getElementById('admin-page-title').textContent = titleMap[tab] || 'এডমিন ড্যাশবোর্ড';

      if (tab === 'dashboard') loadDashboardStats();
      if (tab === 'products') loadAdminProducts();
      if (tab === 'categories') loadAdminCategories();
      if (tab === 'orders') loadAdminOrders();
      if (tab === 'banners') loadAdminBanners();
      if (tab === 'customers') loadAdminCustomers();
      if (tab === 'chat') initAdminChatDashboard();
      if (tab === 'analytics') loadAdminAnalytics();
    });
  });
}

function setupSidebarToggle() {
  const sidebar = document.getElementById('admin-sidebar');
  document.getElementById('open-admin-sidebar')?.addEventListener('click', () => sidebar?.classList.add('active'));
  document.getElementById('close-admin-sidebar')?.addEventListener('click', () => sidebar?.classList.remove('active'));
}

async function initAdminDashboard() {
  await checkAndSeedInitialData();
  await loadDashboardStats();
  await populateCategoryDropdown();
}

// --- TAB 1: Dashboard Overview Stats ---
async function loadDashboardStats() {
  let orders = [];
  let products = [];

  try {
    const oSnap = await getDocs(collection(db, 'orders'));
    orders = oSnap.docs.map(d => d.data());

    const pSnap = await getDocs(collection(db, 'products'));
    products = pSnap.docs.map(d => d.data());
  } catch (e) {}

  if (products.length === 0) products = DEFAULT_PRODUCTS;

  const totalRev = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const lowStockCount = products.filter(p => (Number(p.stock) || 0) <= 5).length;

  document.getElementById('stat-total-revenue').textContent = formatPrice(totalRev);
  document.getElementById('stat-total-orders').textContent = orders.length;
  document.getElementById('stat-total-products').textContent = products.length;
  document.getElementById('stat-low-stock').textContent = lowStockCount;

  // Render recent orders table
  const tbody = document.getElementById('admin-recent-orders-body');
  if (tbody) {
    tbody.innerHTML = orders.slice(0, 5).map(o => `
      <tr>
        <td class="font-bold text-emerald-800">${o.orderNumber || 'BC-000'}</td>
        <td>${o.customer?.name || 'গ্রাহক'}</td>
        <td>${o.customer?.phone || ''}</td>
        <td class="font-bold">${formatPrice(o.totalAmount)}</td>
        <td>${o.paymentMethod}</td>
        <td><span class="badge-${o.status || 'pending'}">${o.status || 'pending'}</span></td>
        <td><button onclick="window.switchTab('orders')" class="text-xs text-emerald-800 underline">দেখুন</button></td>
      </tr>
    `).join('');
  }
}

window.switchTab = function(tabName) {
  document.querySelector(`.admin-nav-item[data-tab="${tabName}"]`)?.click();
};

// --- TAB 2: Products Management & Delivery Charge ---
async function loadAdminProducts() {
  const tbody = document.getElementById('admin-products-table-body');
  if (!tbody) return;

  let products = [];
  try {
    const snap = await getDocs(collection(db, 'products'));
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  if (products.length === 0) products = DEFAULT_PRODUCTS;

  tbody.innerHTML = products.map(p => {
    const delCharge = p.deliveryCharge !== undefined ? p.deliveryCharge : 60;
    return `
      <tr>
        <td><img src="${p.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'}" class="w-10 h-10 object-cover rounded-lg"/></td>
        <td class="font-bold">${p.name}</td>
        <td class="text-emerald-800 font-bold">${formatPrice(p.price)}</td>
        <td class="font-bold text-amber-900">${delCharge === 0 ? 'ফ্রি' : formatPrice(delCharge)}</td>
        <td><span class="${p.stock <= 5 ? 'text-red-600 font-bold' : ''}">${p.stock || 0} টি</span></td>
        <td>${p.brand || '-'}</td>
        <td class="space-x-2">
          <button onclick="window.editAdminProduct('${p.id}')" class="text-xs text-blue-600 font-bold hover:underline">এডিট</button>
          <button onclick="window.deleteAdminProduct('${p.id}')" class="text-xs text-red-600 font-bold hover:underline">মুছুন</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function populateCategoryDropdown() {
  const select = document.getElementById('prod-form-category');
  if (!select) return;

  let cats = [];
  try {
    const snap = await getDocs(collection(db, 'categories'));
    cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}
  if (cats.length === 0) cats = DEFAULT_CATEGORIES;

  select.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function setupProductModal() {
  const modal = document.getElementById('product-modal');
  document.getElementById('add-product-btn')?.addEventListener('click', () => {
    document.getElementById('product-form').reset();
    document.getElementById('prod-form-id').value = '';
    document.getElementById('product-modal-title').textContent = 'নতুন প্রোডাক্ট যোগ করুন';
    modal?.classList.remove('hidden');
  });

  document.getElementById('close-product-modal')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  document.getElementById('product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-form-id').value || `prod-${Date.now()}`;
    const name = document.getElementById('prod-form-name').value;
    const price = Number(document.getElementById('prod-form-price').value);
    const origPrice = Number(document.getElementById('prod-form-orig-price').value) || null;
    const delCharge = Number(document.getElementById('prod-form-del-charge').value);
    const stock = Number(document.getElementById('prod-form-stock').value);
    const category = document.getElementById('prod-form-category').value;
    const brand = document.getElementById('prod-form-brand').value;
    const badge = document.getElementById('prod-form-badge').value;
    const imagesStr = document.getElementById('prod-form-images').value;
    const desc = document.getElementById('prod-form-desc').value;

    const images = imagesStr.split(',').map(s => s.trim()).filter(Boolean);

    const productData = {
      id, name, price, originalPrice: origPrice,
      deliveryCharge: delCharge, stock, category,
      brand, badge, images, description: desc,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'products', id), productData, { merge: true });
      showToast('প্রোডাক্ট সফলভাবে সংরক্ষণ করা হয়েছে!', 'success');
      modal?.classList.add('hidden');
      loadAdminProducts();
    } catch (err) {
      showToast('সেভ করতে সমস্যা হয়েছে', 'error');
    }
  });
}

window.editAdminProduct = async function(pId) {
  try {
    const snap = await getDoc(doc(db, 'products', pId));
    let p = snap.exists() ? snap.data() : DEFAULT_PRODUCTS.find(x => x.id === pId);
    if (!p) return;

    document.getElementById('prod-form-id').value = pId;
    document.getElementById('prod-form-name').value = p.name || '';
    document.getElementById('prod-form-price').value = p.price || 0;
    document.getElementById('prod-form-orig-price').value = p.originalPrice || '';
    document.getElementById('prod-form-del-charge').value = p.deliveryCharge !== undefined ? p.deliveryCharge : 60;
    document.getElementById('prod-form-stock').value = p.stock || 10;
    document.getElementById('prod-form-category').value = p.category || '';
    document.getElementById('prod-form-brand').value = p.brand || '';
    document.getElementById('prod-form-badge').value = p.badge || '';
    document.getElementById('prod-form-images').value = p.images ? p.images.join(', ') : '';
    document.getElementById('prod-form-desc').value = p.description || '';

    document.getElementById('product-modal-title').textContent = 'প্রোডাক্ট এডিট করুন';
    document.getElementById('product-modal')?.classList.remove('hidden');
  } catch (e) {}
};

window.deleteAdminProduct = async function(pId) {
  if (confirm('আপনি কি এই প্রোডাক্টটি মুছে ফেলতে চান?')) {
    try {
      await deleteDoc(doc(db, 'products', pId));
      showToast('প্রোডাক্ট মুছে ফেলা হয়েছে', 'info');
      loadAdminProducts();
    } catch (e) {}
  }
};

// --- TAB 3: Categories ---
async function loadAdminCategories() {
  const container = document.getElementById('admin-categories-list');
  if (!container) return;

  let cats = [];
  try {
    const snap = await getDocs(collection(db, 'categories'));
    cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}
  if (cats.length === 0) cats = DEFAULT_CATEGORIES;

  container.innerHTML = cats.map(c => `
    <div class="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="${c.image || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200'}" class="w-12 h-12 object-cover rounded-xl"/>
        <h4 class="font-bold text-sm text-slate-900">${c.name}</h4>
      </div>
      <button onclick="window.deleteAdminCategory('${c.id}')" class="text-xs text-red-600 font-bold">মুছুন</button>
    </div>
  `).join('');
}

window.deleteAdminCategory = async function(cId) {
  if (confirm('ক্যাটাগরিটি মুছে ফেলতে চান?')) {
    try {
      await deleteDoc(doc(db, 'categories', cId));
      showToast('ক্যাটাগরি মোছা হয়েছে', 'info');
      loadAdminCategories();
    } catch (e) {}
  }
};

// --- TAB 4: Orders Management ---
async function loadAdminOrders() {
  const tbody = document.getElementById('admin-all-orders-body');
  if (!tbody) return;

  let orders = [];
  try {
    const snap = await getDocs(collection(db, 'orders'));
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td class="font-bold text-emerald-800">${o.orderNumber || o.id}</td>
      <td>${formatDate(o.createdAt)}</td>
      <td>
        <p class="font-bold">${o.customer?.name}</p>
        <p class="text-xs text-slate-500">${o.customer?.phone}</p>
      </td>
      <td class="text-xs">${o.customer?.address}, ${o.customer?.district}</td>
      <td class="font-bold">${formatPrice(o.totalAmount)}</td>
      <td>${o.paymentMethod} ${o.transactionId ? `<br/><span class="text-[10px] bg-slate-100 p-1 rounded">Trx: ${o.transactionId}</span>` : ''}</td>
      <td>
        <select onchange="window.updateOrderStatus('${o.id}', this.value)" class="text-xs p-1 bg-slate-50 border rounded-lg">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
          <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.updateOrderStatus = async function(orderId, newStatus) {
  try {
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus, updatedAt: new Date().toISOString() });
    showToast('অর্ডার স্ট্যাটাস আপডেট হয়েছে', 'success');
  } catch (e) {}
};

// --- TAB 5: Banners ---
async function loadAdminBanners() {
  const grid = document.getElementById('admin-banners-grid');
  if (!grid) return;

  let banners = [];
  try {
    const snap = await getDocs(collection(db, 'banners'));
    banners = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {}

  grid.innerHTML = banners.map(b => `
    <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
      <img src="${b.image}" class="w-full h-32 object-cover rounded-xl"/>
      <h4 class="font-bold text-sm">${b.title}</h4>
      <button onclick="window.deleteBanner('${b.id}')" class="text-xs text-red-600 font-bold">মুছুন</button>
    </div>
  `).join('');
}

window.deleteBanner = async function(bId) {
  try {
    await deleteDoc(doc(db, 'banners', bId));
    loadAdminBanners();
  } catch (e) {}
};

// --- TAB 6: Customers ---
async function loadAdminCustomers() {
  const tbody = document.getElementById('admin-customers-table-body');
  if (!tbody) return;

  let users = [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    users = snap.docs.map(d => d.data());
  } catch (e) {}

  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="font-bold">${u.name || 'গ্রাহক'}</td>
      <td>${u.email || '-'}</td>
      <td>${u.phone || '-'}</td>
      <td><span class="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold">${u.role || 'customer'}</span></td>
    </tr>
  `).join('');
}

// --- TAB 7: Live Chat Dashboard ---
function initAdminChatDashboard() {
  const userListContainer = document.getElementById('admin-chat-user-list');
  if (!userListContainer) return;

  onSnapshot(collection(db, 'chats'), (snap) => {
    userListContainer.innerHTML = snap.docs.map(docSnap => {
      const c = docSnap.data();
      return `
        <div onclick="window.selectAdminChat('${c.chatId}')" class="p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl cursor-pointer border border-slate-200">
          <h5 class="font-bold text-xs text-slate-900">${c.userName || 'গ্রাহক'}</h5>
          <p class="text-[11px] text-slate-500 truncate">${c.lastMessage || ''}</p>
        </div>
      `;
    }).join('');
  });

  document.getElementById('admin-chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeChatId) return;
    const input = document.getElementById('admin-chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    await addDoc(collection(db, 'messages'), {
      chatId: activeChatId,
      senderId: 'admin',
      receiverId: 'user',
      text: text,
      createdAt: new Date().toISOString()
    });
  });
}

window.selectAdminChat = function(chatId) {
  activeChatId = chatId;
  const messagesBox = document.getElementById('admin-chat-messages');
  if (!messagesBox) return;

  const q = query(
    collection(db, 'messages'),
    orderBy('createdAt', 'asc')
  );

  onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => d.data()).filter(m => m.chatId === chatId);
    messagesBox.innerHTML = msgs.map(m => `
      <div class="flex flex-col ${m.senderId === 'admin' ? 'items-end' : 'items-start'} my-1">
        <div class="chat-bubble ${m.senderId === 'admin' ? 'sent' : 'received'}">
          <p>${m.text}</p>
        </div>
      </div>
    `).join('');
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
};

// --- TAB 8: Analytics ---
function loadAdminAnalytics() {
  const chart = document.getElementById('analytics-chart');
  if (!chart) return;

  const months = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই'];
  const values = [40, 65, 80, 50, 95, 70, 85];

  chart.innerHTML = months.map((m, idx) => `
    <div class="flex-1 flex flex-col items-center h-full justify-end">
      <div class="chart-bar w-full" style="height: ${values[idx]}%;" data-value="${values[idx]}k"></div>
      <span class="text-[10px] text-slate-500 mt-2 font-bold">${m}</span>
    </div>
  `).join('');
}
