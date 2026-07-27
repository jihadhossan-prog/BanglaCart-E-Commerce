// Admin Dashboard Logic & Role Verification Engine
import { 
  db, 
  auth, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  onAuthStateChanged,
  signOut 
} from "./firebase-config.js";
import { formatPrice, escapeHtml, showToast, formatDate } from "./core.js";

let adminUser = null;

// Initialize Admin Verification Guard
function initAdminGuard() {
  const guardScreen = document.getElementById("admin-guard-screen");
  const guardStatus = document.getElementById("guard-status-text");
  const adminApp = document.getElementById("admin-app");

  if (!auth) {
    if (guardStatus) guardStatus.textContent = "Firebase configuration required. Please fill credentials in firebase-config.js";
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (guardStatus) guardStatus.textContent = "লগইন করা আবশ্যক। রিডাইরেক্ট করা হচ্ছে...";
      setTimeout(() => window.location.href = "./index.html#profile", 1500);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const isSuperAdminEmail = user.email.toLowerCase() === "jihadhossan10000@gmail.com";

      if ((userDoc.exists() && userDoc.data().role === "admin") || isSuperAdminEmail) {
        adminUser = user;
        guardScreen?.classList.add("hidden");
        adminApp?.classList.remove("hidden");
        handleAdminRouter();
      } else {
        if (guardStatus) guardStatus.textContent = "অনুমতি নেই! আপনি এডমিন নন।";
        setTimeout(() => window.location.href = "./index.html", 1500);
      }
    } catch (err) {
      console.error("Admin verification failed:", err);
      if (guardStatus) guardStatus.textContent = "যাচাইকরণ ত্রুটি।";
    }
  });
}

// Admin Navigation Hash Router
function handleAdminRouter() {
  const hash = window.location.hash || "#dashboard";
  const mainEl = document.getElementById("admin-main-content");
  const titleEl = document.getElementById("admin-view-title");
  if (!mainEl) return;

  document.querySelectorAll(".admin-nav-item").forEach(el => el.classList.remove("active"));

  if (hash === "#products") {
    document.getElementById("admin-nav-products")?.classList.add("active");
    if (titleEl) titleEl.textContent = "পণ্য ব্যবস্থাপনা (Product Management)";
    renderProductManagement(mainEl);
  } else if (hash === "#categories") {
    document.getElementById("admin-nav-categories")?.classList.add("active");
    if (titleEl) titleEl.textContent = "ক্যাটাগরি ব্যবস্থাপনা";
    renderCategoryManagement(mainEl);
  } else if (hash === "#banners") {
    document.getElementById("admin-nav-banners")?.classList.add("active");
    if (titleEl) titleEl.textContent = "ব্যানার স্লাইডার ব্যবস্থাপনা";
    renderBannerManagement(mainEl);
  } else if (hash === "#pages") {
    document.getElementById("admin-nav-pages")?.classList.add("active");
    if (titleEl) titleEl.textContent = "পেজ ও তথ্য ব্যবস্থাপনা (Help/Contact/About)";
    renderPagesManagement(mainEl);
  } else if (hash === "#orders") {
    document.getElementById("admin-nav-orders")?.classList.add("active");
    if (titleEl) titleEl.textContent = "অর্ডার মনিটরিং";
    renderOrderManagement(mainEl);
  } else if (hash === "#coupons") {
    document.getElementById("admin-nav-coupons")?.classList.add("active");
    if (titleEl) titleEl.textContent = "কুপন ও ডিসকাউন্ট";
    renderCouponManagement(mainEl);
  } else if (hash === "#chat") {
    document.getElementById("admin-nav-chat")?.classList.add("active");
    if (titleEl) titleEl.textContent = "লাইভ চ্যাট ড্যাশবোর্ড";
    renderAdminChatDashboard(mainEl);
  } else {
    document.getElementById("admin-nav-dashboard")?.classList.add("active");
    if (titleEl) titleEl.textContent = "ড্যাশবোর্ড ওভারভিউ";
    renderDashboardOverview(mainEl);
  }
}

// Render Dashboard Overview
async function renderDashboardOverview(containerEl) {
  containerEl.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="admin-card">
        <span class="text-xs font-semibold text-slate-500">মোট বিক্রি (Revenue)</span>
        <h3 class="text-2xl font-bold text-slate-900 mt-1" id="stat-revenue">৳০</h3>
      </div>

      <div class="admin-card">
        <span class="text-xs font-semibold text-slate-500">মোট অর্ডার</span>
        <h3 class="text-2xl font-bold text-slate-900 mt-1" id="stat-orders">০</h3>
      </div>

      <div class="admin-card">
        <span class="text-xs font-semibold text-slate-500">মোট পণ্য</span>
        <h3 class="text-2xl font-bold text-slate-900 mt-1" id="stat-products">০</h3>
      </div>

      <div class="admin-card">
        <span class="text-xs font-semibold text-slate-500">স্টক আউট অ্যালার্ট</span>
        <h3 class="text-2xl font-bold text-amber-600 mt-1" id="stat-lowstock">০</h3>
      </div>
    </div>

    <div class="admin-card">
      <h3 class="text-sm font-bold text-slate-800 mb-4">সাম্প্রতিক অর্ডার সমূহ</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 text-slate-400">
              <th class="pb-2">অর্ডার আইডি</th>
              <th class="pb-2">গ্রাহক</th>
              <th class="pb-2">টাকা</th>
              <th class="pb-2">পেমেন্ট</th>
              <th class="pb-2">স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody id="recent-orders-table-body">
            <tr><td colspan="5" class="py-4 text-center text-slate-400">অর্ডার লোড হচ্ছে...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Fetch Stats from Firestore
  if (!db) return;
  try {
    const prodSnap = await getDocs(collection(db, "products"));
    document.getElementById("stat-products").textContent = prodSnap.size;

    const orderSnap = await getDocs(collection(db, "orders"));
    document.getElementById("stat-orders").textContent = orderSnap.size;

    let rev = 0;
    const ordersList = [];
    orderSnap.forEach(d => {
      const data = d.data();
      rev += Number(data.totalAmount || 0);
      ordersList.push({ id: d.id, ...data });
    });

    document.getElementById("stat-revenue").textContent = formatPrice(rev);

    const tbody = document.getElementById("recent-orders-table-body");
    if (ordersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">কোনো অর্ডার পাওয়া যায়নি</td></tr>`;
    } else {
      tbody.innerHTML = ordersList.slice(0, 5).map(o => `
        <tr class="border-b border-slate-100">
          <td class="py-3 font-bold text-slate-800">${escapeHtml(o.orderNumber || o.id)}</td>
          <td class="py-3">${escapeHtml(o.customerInfo?.fullName || 'গ্রাহক')}</td>
          <td class="py-3 font-bold text-emerald-700">${formatPrice(o.totalAmount)}</td>
          <td class="py-3 uppercase">${escapeHtml(o.paymentMethod || 'cod')}</td>
          <td class="py-3"><span class="status-badge status-${o.orderStatus || 'pending'}">${escapeHtml(o.orderStatus || 'pending')}</span></td>
        </tr>
      `).join('');
    }

  } catch (err) {
    console.warn("Stats load warning:", err);
  }
}

// Render Product Management View (Mandatory Per-Product Delivery Charge Input)
async function renderProductManagement(containerEl) {
  containerEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold text-slate-800">পণ্য তালিকা</h3>
        <button onclick="window.openAddProductModal()" class="bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 min-h-[44px]">
          + নতুন পণ্য যোগ করুন
        </button>
      </div>

      <div class="admin-card overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 text-slate-500">
              <th class="pb-2">ছবি</th>
              <th class="pb-2">শিরোনাম</th>
              <th class="pb-2">ক্যাটাগরি</th>
              <th class="pb-2">মূল্য</th>
              <th class="pb-2">ডেলিভারি চার্জ</th>
              <th class="pb-2">স্টক</th>
              <th class="pb-2 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody id="admin-products-table-body">
            <tr><td colspan="7" class="py-4 text-center text-slate-400">লোড হচ্ছে...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Product Add/Edit Modal -->
    <div id="product-modal-container"></div>
  `;

  loadProductsTable();
}

async function loadProductsTable() {
  const tbody = document.getElementById("admin-products-table-body");
  if (!tbody || !db) return;

  try {
    const snap = await getDocs(collection(db, "products"));
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-400">কোনো পণ্য পাওয়া যায়নি</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs.map(docSnap => {
      const p = { id: docSnap.id, ...docSnap.data() };
      return `
        <tr class="border-b border-slate-100">
          <td class="py-2"><img src="${p.images?.[0] || ''}" class="w-10 h-10 rounded object-cover bg-slate-100"></td>
          <td class="py-2 font-semibold text-slate-800 max-w-xs truncate">${escapeHtml(p.title)}</td>
          <td class="py-2">${escapeHtml(p.category)}</td>
          <td class="py-2 font-bold text-emerald-700">${formatPrice(p.discountPrice || p.price)}</td>
          <td class="py-2 font-bold text-blue-600">${formatPrice(p.deliveryCharge)}</td>
          <td class="py-2 font-bold">${p.stock || 0}</td>
          <td class="py-2 text-right space-x-2">
            <button onclick="window.deleteProduct('${p.id}')" class="text-red-600 hover:underline min-h-[44px]">মুছুন</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-red-500">পণ্য লোড হতে সমস্যা হয়েছে</td></tr>`;
  }
}

// Modal for Adding New Product with mandatory Per-Product Delivery Charge Field
window.openAddProductModal = async function() {
  const mount = document.getElementById("product-modal-container");
  if (!mount) return;

  let categoryOptionsHtml = `<option value="">ক্যাটাগরি নির্বাচন করুন</option>`;
  if (db) {
    try {
      const catSnap = await getDocs(query(collection(db, "categories"), orderBy("createdAt", "desc")));
      if (!catSnap.empty) {
        categoryOptionsHtml += catSnap.docs.map(docSnap => {
          const c = docSnap.data();
          return `<option value="${escapeHtml(c.slug || docSnap.id)}">${escapeHtml(c.name)}</option>`;
        }).join('');
      } else {
        categoryOptionsHtml += `
          <option value="panjabi">পাঞ্জাবি ও উৎসব</option>
          <option value="electronics">ইলেকট্রনিক্স</option>
          <option value="groceries">খাঁটি খাবার ও মুদি</option>
          <option value="fashion">ফ্যাশন ও লেদার</option>
        `;
      }
    } catch (err) {
      console.warn("Category fetch warning in product modal:", err);
      categoryOptionsHtml += `
        <option value="panjabi">পাঞ্জাবি ও উৎসব</option>
        <option value="electronics">ইলেকট্রনিক্স</option>
        <option value="groceries">খাঁটি খাবার ও মুদি</option>
        <option value="fashion">ফ্যাশন ও লেদার</option>
      `;
    }
  }

  mount.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
        
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-bold text-sm text-slate-900">নতুন পণ্য যোগ করুন</h3>
          <button onclick="document.getElementById('product-modal-container').innerHTML=''" class="text-slate-400 min-h-[44px]">✕</button>
        </div>

        <form onsubmit="window.saveProductSubmit(event)" class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">পণ্যের নাম *</label>
            <input type="text" id="p-title" required placeholder="পণ্যের নাম দিন" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি *</label>
              <select id="p-category" required class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
                ${categoryOptionsHtml}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ব্র্যান্ড</label>
              <input type="text" id="p-brand" placeholder="যেমন: আপন ফ্যাশন" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">মূল্য (৳) *</label>
              <input type="number" id="p-price" required placeholder="1500" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ডিসকাউন্ট মূল্য (৳)</label>
              <input type="number" id="p-discount" placeholder="1200" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
            </div>

            <!-- MANDATORY PER-PRODUCT DELIVERY CHARGE INPUT FIELD -->
            <div>
              <label class="block text-xs font-bold text-blue-800 mb-1">ডেলিভারি চার্জ (৳) *</label>
              <input type="number" id="p-delivery-charge" required placeholder="60" value="60" class="w-full bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs font-bold text-blue-900">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">স্টক পরিমাণ *</label>
              <input type="number" id="p-stock" required placeholder="20" value="10" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">ছবি URL *</label>
              <input type="url" id="p-image" required placeholder="https://..." class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">বিস্তারিত বিবরণ</label>
            <textarea id="p-desc" rows="3" placeholder="পণ্যের গুণাগুণ বর্ণনা করুন..." class="w-full bg-slate-50 border rounded-lg p-2 text-xs"></textarea>
          </div>

          <button type="submit" class="w-full bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs min-h-[44px]">
            পণ্য সংরক্ষণ করুন
          </button>
        </form>

      </div>
    </div>
  `;
};

window.saveProductSubmit = async function(event) {
  event.preventDefault();
  if (!db) return;

  const productData = {
    title: document.getElementById("p-title").value,
    category: document.getElementById("p-category").value,
    brand: document.getElementById("p-brand").value || "আপন",
    price: Number(document.getElementById("p-price").value),
    discountPrice: Number(document.getElementById("p-discount").value) || Number(document.getElementById("p-price").value),
    deliveryCharge: Number(document.getElementById("p-delivery-charge").value) || 0, // Individual Product Delivery Charge
    stock: Number(document.getElementById("p-stock").value) || 0,
    images: [document.getElementById("p-image").value],
    description: document.getElementById("p-desc").value || "",
    rating: 4.8,
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "products"), productData);
    showToast("পণ্য সফলভাবে যোগ করা হয়েছে!");
    document.getElementById('product-modal-container').innerHTML = "";
    loadProductsTable();
  } catch (err) {
    showToast("পণ্য সংরক্ষণ ব্যর্থ হয়েছে", "error");
  }
};

window.deleteProduct = async function(id) {
  if (!confirm("আপনি কি নিশ্চিত এই পণ্যটি মুছে ফেলতে চান?")) return;
  if (!db) return;

  try {
    await deleteDoc(doc(db, "products", id));
    showToast("পণ্যটি মুছে ফেলা হয়েছে");
    loadProductsTable();
  } catch (err) {
    showToast("পণ্য মোছা সম্ভব হয়নি", "error");
  }
};

// Admin Live Chat Dashboard
function renderAdminChatDashboard(containerEl) {
  containerEl.innerHTML = `
    <div class="admin-card space-y-4">
      <h3 class="text-sm font-bold text-slate-800">লাইভ কাস্টমার চ্যাট থ্রেড</h3>
      <div id="admin-chat-threads-list" class="space-y-2">
        <p class="text-xs text-slate-400">চ্যাট লোড হচ্ছে...</p>
      </div>
    </div>
  `;

  if (!db) return;

  onSnapshot(collection(db, "chats"), (snapshot) => {
    const listEl = document.getElementById("admin-chat-threads-list");
    if (!listEl) return;

    if (snapshot.empty) {
      listEl.innerHTML = `<p class="text-xs text-slate-400">কোনো একটিভ চ্যাট থ্রেড নেই</p>`;
      return;
    }

    listEl.innerHTML = snapshot.docs.map(docSnap => {
      const c = docSnap.data();
      return `
        <div class="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
          <div>
            <h4 class="text-xs font-bold text-slate-800">${escapeHtml(c.userName || 'গ্রাহক')}</h4>
            <p class="text-[11px] text-slate-500">${escapeHtml(c.lastMessage || '')}</p>
          </div>
          <span class="text-[10px] text-slate-400">${formatDate(c.lastMessageTimestamp)}</span>
        </div>
      `;
    }).join('');
  });
}

// Category Management
async function renderCategoryManagement(containerEl) {
  containerEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold text-slate-800">ক্যাটাগরি তালিকা</h3>
        <button onclick="window.openAddCategoryModal()" class="bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 min-h-[44px]">
          + নতুন ক্যাটাগরি যোগ করুন
        </button>
      </div>

      <div class="admin-card overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 text-slate-500">
              <th class="pb-2">ছবি</th>
              <th class="pb-2">ক্যাটাগরি নাম</th>
              <th class="pb-2">স্ল্যাগ (ID)</th>
              <th class="pb-2 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody id="admin-categories-table-body">
            <tr><td colspan="4" class="py-4 text-center text-slate-400">লোড হচ্ছে...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="category-modal-container"></div>
  `;

  loadCategoriesTable();
}

async function loadCategoriesTable() {
  const tbody = document.getElementById("admin-categories-table-body");
  if (!tbody || !db) return;

  try {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("createdAt", "desc")));
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">কোনো ক্যাটাগরি যোগ করা হয়নি</td></tr>`;
      return;
    }

    tbody.innerHTML = snap.docs.map(docSnap => {
      const c = { id: docSnap.id, ...docSnap.data() };
      return `
        <tr class="border-b border-slate-100">
          <td class="py-2"><img src="${c.imageUrl || ''}" class="w-10 h-10 rounded object-cover bg-slate-100"></td>
          <td class="py-2 font-bold text-slate-800">${escapeHtml(c.name)}</td>
          <td class="py-2 text-slate-500">${escapeHtml(c.slug || c.id)}</td>
          <td class="py-2 text-right">
            <button onclick="window.deleteCategory('${c.id}')" class="text-red-600 hover:underline min-h-[44px]">মুছুন</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-red-500">ক্যাটাগরি লোড হতে সমস্যা হয়েছে</td></tr>`;
  }
}

window.openAddCategoryModal = function() {
  const mount = document.getElementById("category-modal-container");
  if (!mount) return;

  mount.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl p-5 w-full max-w-md space-y-4">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-bold text-sm text-slate-900">নতুন ক্যাটাগরি যোগ করুন</h3>
          <button onclick="document.getElementById('category-modal-container').innerHTML=''" class="text-slate-400 min-h-[44px]">✕</button>
        </div>

        <form onsubmit="window.saveCategorySubmit(event)" class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি নাম *</label>
            <input type="text" id="cat-name" required placeholder="যেমন: পাঞ্জাবি ও উৎসব" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ক্যাটাগরি স্ল্যাগ/ID *</label>
            <input type="text" id="cat-slug" required placeholder="যেমন: panjabi" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ছবি URL (Image URL) *</label>
            <input type="url" id="cat-image" required placeholder="https://images.unsplash.com/..." class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
          </div>

          <button type="submit" class="w-full bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs min-h-[44px]">
            ক্যাটাগরি সংরক্ষণ করুন
          </button>
        </form>
      </div>
    </div>
  `;
};

window.saveCategorySubmit = async function(event) {
  event.preventDefault();
  if (!db) return;

  const name = document.getElementById("cat-name").value.trim();
  const slug = document.getElementById("cat-slug").value.trim().toLowerCase();
  const imageUrl = document.getElementById("cat-image").value.trim();

  try {
    await addDoc(collection(db, "categories"), {
      name,
      slug,
      imageUrl,
      createdAt: new Date().toISOString()
    });
    showToast("ক্যাটাগরি সফলভাবে যোগ করা হয়েছে!");
    document.getElementById("category-modal-container").innerHTML = "";
    loadCategoriesTable();
  } catch (err) {
    showToast("ক্যাটাগরি যোগ ব্যর্থ হয়েছে", "error");
  }
};

window.deleteCategory = async function(id) {
  if (!confirm("আপনি কি নিশ্চিত এই ক্যাটাগরি মুছে ফেলতে চান?")) return;
  if (!db) return;

  try {
    await deleteDoc(doc(db, "categories", id));
    showToast("ক্যাটাগরি মুছে ফেলা হয়েছে");
    loadCategoriesTable();
  } catch (err) {
    showToast("ক্যাটাগরি মোছা সম্ভব হয়নি", "error");
  }
};

// Banner Slider Management
async function renderBannerManagement(containerEl) {
  containerEl.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-sm font-bold text-slate-800">স্লাইডার ব্যানার তালিকা</h3>
        <button onclick="window.openAddBannerModal()" class="bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 min-h-[44px]">
          + নতুন ব্যানার যোগ করুন
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="admin-banners-grid">
        <div class="col-span-full py-4 text-center text-slate-400 text-xs">লোড হচ্ছে...</div>
      </div>
    </div>

    <div id="banner-modal-container"></div>
  `;

  loadBannersGrid();
}

async function loadBannersGrid() {
  const gridEl = document.getElementById("admin-banners-grid");
  if (!gridEl || !db) return;

  try {
    const snap = await getDocs(query(collection(db, "banners"), orderBy("createdAt", "desc")));
    if (snap.empty) {
      gridEl.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs bg-white border rounded-xl">কোনো স্লাইডার ব্যানার যুক্ত করা হয়নি</div>`;
      return;
    }

    gridEl.innerHTML = snap.docs.map(docSnap => {
      const b = { id: docSnap.id, ...docSnap.data() };
      return `
        <div class="bg-white border rounded-xl overflow-hidden p-3 space-y-2">
          <div class="relative aspect-[21/9] bg-slate-100 rounded-lg overflow-hidden">
            <img src="${b.imageUrl}" class="w-full h-full object-cover">
          </div>
          <div class="flex justify-between items-center">
            <div>
              <h4 class="text-xs font-bold text-slate-800">${escapeHtml(b.title || 'স্লাইডার ব্যানার')}</h4>
              <p class="text-[10px] text-slate-400">${escapeHtml(b.link || 'কোনো লিংক নেই')}</p>
            </div>
            <button onclick="window.deleteBanner('${b.id}')" class="text-xs text-red-600 font-bold hover:underline min-h-[44px] px-2">
              মুছুন
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    gridEl.innerHTML = `<div class="col-span-full py-4 text-center text-red-500 text-xs">ব্যানার লোড হতে সমস্যা হয়েছে</div>`;
  }
}

window.openAddBannerModal = function() {
  const mount = document.getElementById("banner-modal-container");
  if (!mount) return;

  mount.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl p-5 w-full max-w-md space-y-4">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-bold text-sm text-slate-900">নতুন স্লাইডার ব্যানার যোগ করুন</h3>
          <button onclick="document.getElementById('banner-modal-container').innerHTML=''" class="text-slate-400 min-h-[44px]">✕</button>
        </div>

        <form onsubmit="window.saveBannerSubmit(event)" class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ব্যানার শিরোনাম/ক্যাপশন (ঐচ্ছিক)</label>
            <input type="text" id="banner-title" placeholder="যেমন: বিশেষ অফার ৫০% ছাড়" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ব্যানার ছবি URL *</label>
            <input type="url" id="banner-image" required placeholder="https://images.unsplash.com/..." class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">টার্গেট লিংক / ক্যাটাগরি (ঐচ্ছিক)</label>
            <input type="text" id="banner-link" placeholder="#category-panjabi" class="w-full bg-slate-50 border rounded-lg p-2 text-xs">
          </div>

          <button type="submit" class="w-full bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs min-h-[44px]">
            ব্যানার সংরক্ষণ করুন
          </button>
        </form>
      </div>
    </div>
  `;
};

window.saveBannerSubmit = async function(event) {
  event.preventDefault();
  if (!db) return;

  const title = document.getElementById("banner-title").value.trim();
  const imageUrl = document.getElementById("banner-image").value.trim();
  const link = document.getElementById("banner-link").value.trim();

  try {
    await addDoc(collection(db, "banners"), {
      title,
      imageUrl,
      link,
      createdAt: new Date().toISOString()
    });
    showToast("স্লাইডার ব্যানার যোগ করা হয়েছে!");
    document.getElementById("banner-modal-container").innerHTML = "";
    loadBannersGrid();
  } catch (err) {
    showToast("ব্যানার যোগ ব্যর্থ হয়েছে", "error");
  }
};

window.deleteBanner = async function(id) {
  if (!confirm("আপনি কি নিশ্চিত এই ব্যানার মুছে ফেলতে চান?")) return;
  if (!db) return;

  try {
    await deleteDoc(doc(db, "banners", id));
    showToast("ব্যানার মুছে ফেলা হয়েছে");
    loadBannersGrid();
  } catch (err) {
    showToast("ব্যানার মোছা সম্ভব হয়নি", "error");
  }
};

function renderOrderManagement(containerEl) {
  containerEl.innerHTML = `<div class="admin-card"><h3 class="text-sm font-bold">অর্ডার ড্যাশবোর্ড সক্রিয়</h3></div>`;
}

function renderCouponManagement(containerEl) {
  containerEl.innerHTML = `<div class="admin-card"><h3 class="text-sm font-bold">কুপন কন্ট্রোল প্যানেল সক্রিয়</h3></div>`;
}

// Pages & Information Management (Help Center, Contact Us, About Us)
async function renderPagesManagement(containerEl) {
  containerEl.innerHTML = `
    <div class="space-y-6 max-w-4xl">
      <!-- Header Tabs -->
      <div class="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button onclick="window.switchPagesTab('about')" id="tab-btn-about" class="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 text-white min-h-[44px]">
          ১. আমাদের সম্পর্কে (About Us)
        </button>
        <button onclick="window.switchPagesTab('contact')" id="tab-btn-contact" class="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 min-h-[44px]">
          ২. যোগাযোগ তথ্য (Contact Us)
        </button>
        <button onclick="window.switchPagesTab('help')" id="tab-btn-help" class="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 min-h-[44px]">
          ৩. হেল্প সেন্টার ও এফএকিউ (Help & FAQ)
        </button>
      </div>

      <!-- Main Form Container -->
      <form onsubmit="window.savePagesInfoSubmit(event)" class="space-y-6">

        <!-- 1. About Us Tab Content -->
        <div id="pages-tab-about" class="admin-card space-y-4">
          <h3 class="text-sm font-bold text-slate-800 border-b pb-2">আমাদের সম্পর্কে (About Us) পেজ সম্পাদনা</h3>
          
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">পেজ শিরোনাম (Headline)</label>
            <input type="text" id="page-about-title" placeholder="আপনবাজার — আপনার বিশ্বাসী অনলাইন শপিং প্ল্যাটফর্ম" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">বিস্তারিত বিবরণ (Full Description)</label>
            <textarea id="page-about-desc" rows="4" placeholder="আপনবাজার বাংলাদেশের একটি প্রতিশ্রুতিশীল ই-কমার্স শপ..." class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs"></textarea>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ব্যানার / লোগো ছবি URL</label>
            <input type="url" id="page-about-image" placeholder="https://images.unsplash.com/..." class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">হাইলাইটস / বৈশিষ্ট্যসমূহ (প্রতিটি লাইনে ১টি)</label>
            <textarea id="page-about-highlights" rows="3" placeholder="১০০% খাঁটি ও মানসম্মত পণ্য&#10;দ্রুততম ক্যাশ অন ডেলিভারি&#10;সহজ রিটার্ন ও রিফান্ড নীতি" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs"></textarea>
          </div>
        </div>

        <!-- 2. Contact Us Tab Content -->
        <div id="pages-tab-contact" class="admin-card space-y-4 hidden">
          <h3 class="text-sm font-bold text-slate-800 border-b pb-2">যোগাযোগ করুন (Contact Info) তথ্য সম্পাদনা</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">হটলাইন / মোবাইল নম্বর *</label>
              <input type="tel" id="page-contact-phone" placeholder="+880 1700-000000" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">সাপোর্ট ইমেইল ঠিকানা *</label>
              <input type="email" id="page-contact-email" placeholder="support@aponbazar.com" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">হোয়াটসঅ্যাপ নম্বর (WhatsApp Number)</label>
              <input type="tel" id="page-contact-whatsapp" placeholder="+880 1700-000000" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">অফিস সেবার সময় (Working Hours)</label>
              <input type="text" id="page-contact-hours" placeholder="প্রতিদিন সকাল ৯:০০ - রাত ১০:০০" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">অফিসের প্রধান ঠিকানা (Office Address)</label>
            <textarea id="page-contact-address" rows="2" placeholder="ধানমন্ডি ৩২, ঢাকা-১২০৯, বাংলাদেশ" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs"></textarea>
          </div>
        </div>

        <!-- 3. Help Center Tab Content -->
        <div id="pages-tab-help" class="admin-card space-y-4 hidden">
          <h3 class="text-sm font-bold text-slate-800 border-b pb-2">হেল্প সেন্টার ও এফএকিউ (Help Center & FAQs)</h3>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">হেল্প সেন্টার সূচনা বার্তা</label>
            <input type="text" id="page-help-title" placeholder="আমরা কিভাবে আপনাকে সাহায্য করতে পারি?" class="w-full bg-slate-50 border rounded-lg p-2.5 text-xs">
          </div>

          <!-- FAQ Manager List -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="block text-xs font-bold text-slate-700">সাধারণ প্রশ্ন ও উত্তর (FAQs)</label>
              <button type="button" onclick="window.addNewFaqItem()" class="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-lg hover:bg-emerald-200 min-h-[44px]">
                + নতুন প্রশ্ন যোগ করুন
              </button>
            </div>
            
            <div id="faq-items-list" class="space-y-3">
              <!-- Dynamically populated FAQ boxes -->
            </div>
          </div>
        </div>

        <!-- Save Button Sticky Bar -->
        <div class="bg-white p-4 border rounded-xl flex items-center justify-between shadow-sm">
          <span class="text-xs text-slate-500 font-semibold">সব তথ্যের পরিবর্তন একসাথেই ডাটাবেজে সংরক্ষিত হবে।</span>
          <button type="submit" class="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs min-h-[44px]">
            💾 সমস্ত তথ্য সংরক্ষণ করুন
          </button>
        </div>

      </form>
    </div>
  `;

  // Load Existing Pages Data from Firestore
  loadPagesInfoData();
}

let loadedFaqs = [];

async function loadPagesInfoData() {
  if (!db) return;

  try {
    const docSnap = await getDoc(doc(db, "settings", "pages_info"));
    let data = {};
    if (docSnap.exists()) {
      data = docSnap.data();
    }

    // Fill About
    document.getElementById("page-about-title").value = data.about_title || "আপনবাজার — আপনার বিশ্বাসী অনলাইন শপিং প্ল্যাটফর্ম";
    document.getElementById("page-about-desc").value = data.about_desc || "আপনবাজার বাংলাদেশের অন্যতম বিশ্বস্ত অনলাইন শপিং গন্তব্য। আমরা সেরা মানের ক্যাটাগরির পোশাক, ইলেকট্রনিক্স, খাঁটি খাবার ও প্রাত্যহিক জীবনের প্রয়োজনীয় পণ্য দ্রুত ডেলিভারি দিয়ে থাকি।";
    document.getElementById("page-about-image").value = data.about_image || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80";
    document.getElementById("page-about-highlights").value = data.about_highlights || "১০০% আসল ও খাঁটি পণ্যের নিশ্চয়তা\nসারাদেশে দ্রুততম ক্যাশ অন ডেলিভারি\n২৪/৭ গ্রাহক সেবা ও সরাসরি সাপোর্ট চ্যাট\nসহজ রিটার্ন ও রিফান্ড সুবিধা";

    // Fill Contact
    document.getElementById("page-contact-phone").value = data.contact_phone || "+880 1700-000000";
    document.getElementById("page-contact-email").value = data.contact_email || "support@aponbazar.com";
    document.getElementById("page-contact-whatsapp").value = data.contact_whatsapp || "+880 1700-000000";
    document.getElementById("page-contact-hours").value = data.contact_hours || "প্রতিদিন সকাল ৯:০০ - রাত ১০:০০";
    document.getElementById("page-contact-address").value = data.contact_address || "ধানমন্ডি ৩২, ঢাকা-১২০৯, বাংলাদেশ";

    // Fill Help
    document.getElementById("page-help-title").value = data.help_title || "আমরা কিভাবে আপনাকে সাহায্য করতে পারি?";
    
    loadedFaqs = data.faqs || [
      { q: "কিভাবে অর্ডার করবো?", a: "আপনার পছন্দনীয় পণ্যটি নির্বাচন করে 'অর্ডার করুন' বাটনে ক্লিক করুন। ঠিকানা প্রদান করে ক্যাশ অন ডেলিভারিতে সহজে অর্ডার সম্পন্ন করুন।" },
      { q: "ডেলিভারি চার্জ কত?", a: "পণ্য অনুযায়ী এবং জেলা ভিত্তিতে ৫০-১২০ টাকা পর্যন্ত ডেলিভারি চার্জ প্রযোজ্য হয়।" },
      { q: "পণ্য পছন্দ না হলে পরিবর্তন করা যাবে?", a: "জি, পণ্য হাতে পাওয়ার ৩ দিনের মধ্যে কোনো সমস্যা থাকলে সহজে রিটার্ন করতে পারবেন।" }
    ];

    renderFaqItems();
  } catch (err) {
    console.warn("Failed to load pages info:", err);
  }
}

function renderFaqItems() {
  const container = document.getElementById("faq-items-list");
  if (!container) return;

  if (loadedFaqs.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 bg-slate-50 border rounded-lg">কোনো প্রশ্ন যোগ করা হয়নি</div>`;
    return;
  }

  container.innerHTML = loadedFaqs.map((faq, index) => `
    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 relative">
      <div class="flex justify-between items-center">
        <span class="text-xs font-bold text-emerald-800">প্রশ্ন #${index + 1}</span>
        <button type="button" onclick="window.removeFaqItem(${index})" class="text-xs text-red-600 font-bold hover:underline min-h-[44px] px-2">
          ✕ মুছুন
        </button>
      </div>
      <input type="text" value="${escapeHtml(faq.q || '')}" onchange="window.updateFaqQ(${index}, this.value)" placeholder="প্রশ্ন লিখুন..." class="w-full bg-white border rounded-lg p-2 text-xs font-bold">
      <textarea rows="2" onchange="window.updateFaqA(${index}, this.value)" placeholder="উত্তর লিখুন..." class="w-full bg-white border rounded-lg p-2 text-xs">${escapeHtml(faq.a || '')}</textarea>
    </div>
  `).join('');
}

window.addNewFaqItem = function() {
  loadedFaqs.push({ q: "", a: "" });
  renderFaqItems();
};

window.removeFaqItem = function(index) {
  loadedFaqs.splice(index, 1);
  renderFaqItems();
};

window.updateFaqQ = function(index, val) {
  if (loadedFaqs[index]) loadedFaqs[index].q = val;
};

window.updateFaqA = function(index, val) {
  if (loadedFaqs[index]) loadedFaqs[index].a = val;
};

window.switchPagesTab = function(tabName) {
  const tabs = ['about', 'contact', 'help'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`pages-tab-${t}`);
    if (t === tabName) {
      btn?.classList.remove('bg-slate-100', 'text-slate-700');
      btn?.classList.add('bg-emerald-700', 'text-white');
      content?.classList.remove('hidden');
    } else {
      btn?.classList.remove('bg-emerald-700', 'text-white');
      btn?.classList.add('bg-slate-100', 'text-slate-700');
      content?.classList.add('hidden');
    }
  });
};

window.savePagesInfoSubmit = async function(event) {
  event.preventDefault();
  if (!db) return;

  const about_title = document.getElementById("page-about-title")?.value.trim();
  const about_desc = document.getElementById("page-about-desc")?.value.trim();
  const about_image = document.getElementById("page-about-image")?.value.trim();
  const about_highlights = document.getElementById("page-about-highlights")?.value.trim();

  const contact_phone = document.getElementById("page-contact-phone")?.value.trim();
  const contact_email = document.getElementById("page-contact-email")?.value.trim();
  const contact_whatsapp = document.getElementById("page-contact-whatsapp")?.value.trim();
  const contact_hours = document.getElementById("page-contact-hours")?.value.trim();
  const contact_address = document.getElementById("page-contact-address")?.value.trim();

  const help_title = document.getElementById("page-help-title")?.value.trim();

  const payload = {
    about_title,
    about_desc,
    about_image,
    about_highlights,
    contact_phone,
    contact_email,
    contact_whatsapp,
    contact_hours,
    contact_address,
    help_title,
    faqs: loadedFaqs.filter(f => f.q.trim().length > 0),
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, "settings", "pages_info"), payload, { merge: true });
    showToast("পেজ ও তথ্য সফলভাবে সংরক্ষণ করা হয়েছে!");
  } catch (err) {
    console.error("Save pages info failed:", err);
    showToast("তথ্য সংরক্ষণে সমস্যা হয়েছে", "error");
  }
};

// Admin Events Init
window.addEventListener("DOMContentLoaded", () => {
  initAdminGuard();

  document.getElementById("btn-admin-logout")?.addEventListener("click", () => {
    signOut(auth);
    window.location.href = "./index.html";
  });

  window.addEventListener("hashchange", handleAdminRouter);
});
