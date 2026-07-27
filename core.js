// Core Utility Functions Shared Across User & Admin UIs

// Currency Formatter (BDT ৳)
export function formatPrice(amount) {
  const num = Number(amount) || 0;
  return '৳' + num.toLocaleString('bn-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Toast Notification Manager
export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconMarkup = type === 'success' 
    ? `<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
    : `<svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

  toast.innerHTML = `
    ${iconMarkup}
    <span class="flex-1">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// HTML Escaper for Security
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Calculate Delivery Charge for Cart Items (Mandatory Itemized Calculation)
export function calculateCartDeliveryCharge(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  // Sum item delivery charge * quantity or item delivery charge
  let totalDelivery = 0;
  items.forEach(item => {
    const itemCharge = Number(item.deliveryCharge || item.product?.deliveryCharge) || 0;
    totalDelivery += itemCharge;
  });
  return totalDelivery;
}

// Calculate Total Cart Price
export function calculateCartTotal(items, discount = 0) {
  let subtotal = 0;
  items.forEach(item => {
    const price = Number(item.discountPrice || item.price || item.product?.discountPrice || item.product?.price) || 0;
    const qty = Number(item.quantity) || 1;
    subtotal += price * qty;
  });

  const deliveryFee = calculateCartDeliveryCharge(items);
  const total = Math.max(0, subtotal + deliveryFee - discount);

  return { subtotal, deliveryFee, discount, total };
}

// Date Formatting Helper
export function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Image Placeholder Fallback
export function getImageUrl(url, fallbackType = 'product') {
  if (url && typeof url === 'string' && url.trim().length > 0) {
    return url;
  }
  if (fallbackType === 'avatar') {
    return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%23CBD5E1"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>';
  }
  return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="%23F1F5F9" stroke="%2394A3B8" stroke-width="1"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
}

// PWA Service Worker Registration
export function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('PWA Service Worker registration skipped:', err);
      });
    });
  }
}
